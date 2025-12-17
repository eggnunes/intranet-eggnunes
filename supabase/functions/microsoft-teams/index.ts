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
  console.log('Getting access token...');
  console.log('Client ID exists:', !!MICROSOFT_CLIENT_ID);
  console.log('Tenant ID exists:', !!MICROSOFT_TENANT_ID);
  console.log('Client Secret exists:', !!MICROSOFT_CLIENT_SECRET);
  
  if (!MICROSOFT_CLIENT_ID || !MICROSOFT_TENANT_ID || !MICROSOFT_CLIENT_SECRET) {
    throw new Error('Microsoft credentials not configured. Please check MICROSOFT_CLIENT_ID, MICROSOFT_TENANT_ID, and MICROSOFT_CLIENT_SECRET secrets.');
  }
  
  const tokenUrl = `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/token`;
  console.log('Token URL:', tokenUrl);
  
  const params = new URLSearchParams();
  params.append('client_id', MICROSOFT_CLIENT_ID);
  params.append('client_secret', MICROSOFT_CLIENT_SECRET);
  params.append('scope', 'https://graph.microsoft.com/.default');
  params.append('grant_type', 'client_credentials');

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const responseText = await response.text();
  console.log('Token response status:', response.status);
  
  if (!response.ok) {
    console.error('Token error response:', responseText);
    throw new Error(`Failed to get access token: ${response.status} - ${responseText}`);
  }

  const data = JSON.parse(responseText);
  console.log('Access token obtained successfully');
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

      case 'get-preview-url': {
        // Get embeddable preview URL for a file
        if (!driveId || !itemId) {
          return new Response(JSON.stringify({ error: 'driveId and itemId are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        try {
          const previewResponse = await fetch(`https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/preview`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
          });

          if (!previewResponse.ok) {
            const errorText = await previewResponse.text();
            console.error('Preview error:', errorText);
            return new Response(JSON.stringify({ error: 'Preview not available', details: errorText }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          const previewData = await previewResponse.json();
          return new Response(JSON.stringify({ previewUrl: previewData.getUrl }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (error) {
          console.error('Preview error:', error);
          return new Response(JSON.stringify({ error: 'Failed to get preview URL' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      case 'get-edit-url': {
        // Get shareable edit URL for a file
        if (!driveId || !itemId) {
          return new Response(JSON.stringify({ error: 'driveId and itemId are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        try {
          const linkResponse = await fetch(`https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/createLink`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              type: 'edit',
              scope: 'organization'
            }),
          });

          if (!linkResponse.ok) {
            const errorText = await linkResponse.text();
            console.error('Edit link error:', errorText);
            return new Response(JSON.stringify({ error: 'Edit link not available', details: errorText }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          const linkData = await linkResponse.json();
          return new Response(JSON.stringify({ editUrl: linkData.link?.webUrl }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (error) {
          console.error('Edit link error:', error);
          return new Response(JSON.stringify({ error: 'Failed to get edit URL' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
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

      case 'find-folder-by-path': {
        // Find a folder by path (e.g., "Operacional - Clientes/João Silva")
        const { path } = await req.json();
        if (!driveId || !path) {
          return new Response(JSON.stringify({ error: 'driveId and path are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        try {
          const encodedPath = path.split('/').map((segment: string) => encodeURIComponent(segment)).join('/');
          const item = await graphRequest(`/drives/${driveId}/root:/${encodedPath}`, accessToken);
          return new Response(JSON.stringify({ found: true, item }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (error: any) {
          // Folder not found
          if (error.message?.includes('404')) {
            return new Response(JSON.stringify({ found: false }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          throw error;
        }
      }

      case 'create-folder-by-path': {
        // Create a folder by path, creating intermediate folders if needed
        const { path: folderPath } = await req.json();
        if (!driveId || !folderPath) {
          return new Response(JSON.stringify({ error: 'driveId and path are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        const pathSegments = folderPath.split('/').filter((s: string) => s.trim());
        let currentParentId: string | null = null;
        let lastCreatedFolder: any = null;
        
        for (const segment of pathSegments) {
          // Check if folder exists at current level
          let existingFolder: any = null;
          try {
            const currentPath = pathSegments.slice(0, pathSegments.indexOf(segment) + 1).join('/');
            const encodedPath = currentPath.split('/').map((s: string) => encodeURIComponent(s)).join('/');
            existingFolder = await graphRequest(`/drives/${driveId}/root:/${encodedPath}`, accessToken);
          } catch (e) {
            // Folder doesn't exist
          }
          
          if (existingFolder?.id) {
            currentParentId = existingFolder.id;
            lastCreatedFolder = existingFolder;
          } else {
            // Create folder
            let endpoint = `/drives/${driveId}/root/children`;
            if (currentParentId) {
              endpoint = `/drives/${driveId}/items/${currentParentId}/children`;
            }
            
            const newFolder = await graphRequest(endpoint, accessToken, {
              method: 'POST',
              body: JSON.stringify({
                name: segment,
                folder: {},
                '@microsoft.graph.conflictBehavior': 'fail'
              }),
            });
            
            currentParentId = newFolder.id;
            lastCreatedFolder = newFolder;
          }
        }
        
        return new Response(JSON.stringify({ success: true, folder: lastCreatedFolder }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'move-item': {
        // Move a file or folder to a new location
        const { targetFolderId, targetDriveId } = await req.json();
        if (!driveId || !itemId) {
          return new Response(JSON.stringify({ error: 'driveId and itemId are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        const movePayload: any = {};
        
        if (targetFolderId) {
          movePayload.parentReference = { id: targetFolderId };
        } else {
          // Move to root
          movePayload.parentReference = { path: `/drives/${targetDriveId || driveId}/root` };
        }
        
        const movedItem = await graphRequest(`/drives/${driveId}/items/${itemId}`, accessToken, {
          method: 'PATCH',
          body: JSON.stringify(movePayload),
        });
        
        return new Response(JSON.stringify(movedItem), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'upload': {
        // Upload a file - supports files of any size via resumable upload
        if (!driveId || !fileName || !fileContent) {
          return new Response(JSON.stringify({ error: 'driveId, fileName, and fileContent are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // Decode base64 content
        const binaryContent = Uint8Array.from(atob(fileContent), c => c.charCodeAt(0));
        const fileSize = binaryContent.length;
        
        // For small files (< 4MB), use simple upload
        if (fileSize < 4 * 1024 * 1024) {
          let endpoint = `/drives/${driveId}/root:/${fileName}:/content`;
          if (folderId) {
            endpoint = `/drives/${driveId}/items/${folderId}:/${fileName}:/content`;
          }
          
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
        
        // For larger files, use resumable upload session
        let createSessionEndpoint = `/drives/${driveId}/root:/${fileName}:/createUploadSession`;
        if (folderId) {
          createSessionEndpoint = `/drives/${driveId}/items/${folderId}:/${fileName}:/createUploadSession`;
        }
        
        // Create upload session
        const sessionResponse = await fetch(`https://graph.microsoft.com/v1.0${createSessionEndpoint}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            item: {
              '@microsoft.graph.conflictBehavior': 'rename',
              name: fileName,
            },
          }),
        });

        if (!sessionResponse.ok) {
          const errorText = await sessionResponse.text();
          console.error('Create session error:', errorText);
          throw new Error(`Failed to create upload session: ${sessionResponse.status}`);
        }

        const session = await sessionResponse.json();
        const uploadUrl = session.uploadUrl;
        
        // Upload in chunks (10MB chunks for better performance)
        const chunkSize = 10 * 1024 * 1024; // 10MB
        let uploadedFile = null;
        
        for (let offset = 0; offset < fileSize; offset += chunkSize) {
          const end = Math.min(offset + chunkSize, fileSize);
          const chunk = binaryContent.slice(offset, end);
          
          const chunkResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
              'Content-Length': chunk.length.toString(),
              'Content-Range': `bytes ${offset}-${end - 1}/${fileSize}`,
            },
            body: chunk,
          });

          if (!chunkResponse.ok && chunkResponse.status !== 202) {
            const errorText = await chunkResponse.text();
            console.error('Chunk upload error:', errorText);
            throw new Error(`Chunk upload failed: ${chunkResponse.status}`);
          }

          // Last chunk returns the file metadata
          if (chunkResponse.status === 200 || chunkResponse.status === 201) {
            uploadedFile = await chunkResponse.json();
          }
        }

        return new Response(JSON.stringify(uploadedFile || { success: true }), {
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
