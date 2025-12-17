import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MICROSOFT_CLIENT_ID = Deno.env.get('MICROSOFT_CLIENT_ID');
const MICROSOFT_TENANT_ID = Deno.env.get('MICROSOFT_TENANT_ID');
const MICROSOFT_CLIENT_SECRET = Deno.env.get('MICROSOFT_CLIENT_SECRET');

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

async function getAccessToken(): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/token`;
  
  const params = new URLSearchParams();
  params.append('client_id', MICROSOFT_CLIENT_ID!);
  params.append('client_secret', MICROSOFT_CLIENT_SECRET!);
  params.append('scope', 'https://graph.microsoft.com/.default');
  params.append('grant_type', 'client_credentials');

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Token error:', errorText);
    throw new Error(`Failed to get access token: ${response.status}`);
  }

  const data: TokenResponse = await response.json();
  return data.access_token;
}

async function graphRequest(endpoint: string, accessToken: string, options: RequestInit = {}) {
  const url = `https://graph.microsoft.com/v1.0${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Graph API error for ${endpoint}:`, errorText);
    throw new Error(`Graph API error: ${response.status} - ${errorText}`);
  }

  // For download requests, return the response directly
  if (options.headers && (options.headers as any)['Accept'] === 'application/octet-stream') {
    return response;
  }

  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return await response.json();
  }
  
  return response;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is approved
    const { data: profile } = await supabase
      .from('profiles')
      .select('approval_status, is_active')
      .eq('id', user.id)
      .single();

    if (!profile || profile.approval_status !== 'approved' || !profile.is_active) {
      return new Response(JSON.stringify({ error: 'User not approved' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, siteId, driveId, itemId, folderId, folderName, fileName, fileContent } = await req.json();
    
    console.log(`Microsoft Teams action: ${action}`);

    const accessToken = await getAccessToken();

    switch (action) {
      case 'list-sites': {
        // List all SharePoint sites (Teams sites)
        const sites = await graphRequest('/sites?search=*', accessToken);
        return new Response(JSON.stringify(sites), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'list-drives': {
        // List drives for a specific site
        if (!siteId) {
          return new Response(JSON.stringify({ error: 'siteId is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const drives = await graphRequest(`/sites/${siteId}/drives`, accessToken);
        return new Response(JSON.stringify(drives), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'list-items': {
        // List items in a drive or folder
        if (!driveId) {
          return new Response(JSON.stringify({ error: 'driveId is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        let endpoint = `/drives/${driveId}/root/children`;
        if (folderId) {
          endpoint = `/drives/${driveId}/items/${folderId}/children`;
        }
        
        const items = await graphRequest(endpoint, accessToken);
        return new Response(JSON.stringify(items), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'download': {
        // Get download URL for a file
        if (!driveId || !itemId) {
          return new Response(JSON.stringify({ error: 'driveId and itemId are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        const item = await graphRequest(`/drives/${driveId}/items/${itemId}`, accessToken);
        const downloadUrl = item['@microsoft.graph.downloadUrl'];
        
        return new Response(JSON.stringify({ downloadUrl, item }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'create-folder': {
        // Create a new folder
        if (!driveId || !folderName) {
          return new Response(JSON.stringify({ error: 'driveId and folderName are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        let endpoint = `/drives/${driveId}/root/children`;
        if (folderId) {
          endpoint = `/drives/${driveId}/items/${folderId}/children`;
        }
        
        const folder = await graphRequest(endpoint, accessToken, {
          method: 'POST',
          body: JSON.stringify({
            name: folderName,
            folder: {},
            '@microsoft.graph.conflictBehavior': 'rename'
          }),
        });
        
        return new Response(JSON.stringify(folder), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'upload': {
        // Upload a file (small files < 4MB)
        if (!driveId || !fileName || !fileContent) {
          return new Response(JSON.stringify({ error: 'driveId, fileName, and fileContent are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        let endpoint = `/drives/${driveId}/root:/${fileName}:/content`;
        if (folderId) {
          endpoint = `/drives/${driveId}/items/${folderId}:/${fileName}:/content`;
        }
        
        // Decode base64 content
        const binaryContent = Uint8Array.from(atob(fileContent), c => c.charCodeAt(0));
        
        const uploadResponse = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/octet-stream',
          },
          body: binaryContent,
        });

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          console.error('Upload error:', errorText);
          throw new Error(`Upload failed: ${uploadResponse.status}`);
        }

        const uploadedFile = await uploadResponse.json();
        return new Response(JSON.stringify(uploadedFile), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'delete': {
        // Delete a file or folder
        if (!driveId || !itemId) {
          return new Response(JSON.stringify({ error: 'driveId and itemId are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        await fetch(`https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'search': {
        // Search for files
        if (!driveId) {
          return new Response(JSON.stringify({ error: 'driveId is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        const { query } = await req.json();
        const searchResults = await graphRequest(
          `/drives/${driveId}/root/search(q='${encodeURIComponent(query || '')}')`,
          accessToken
        );
        
        return new Response(JSON.stringify(searchResults), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    console.error('Microsoft Teams error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
