import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Teams/SharePoint configuration - arquivo está no site Jurídico, pasta Operacional
const SITE_NAME = 'Jurídico';
const FOLDER_PATH = 'Operacional';
const FILE_NAME = 'Planilha de Decisões Favoráveis.xlsx';

// Column mapping for Excel spreadsheet
const EXCEL_COLUMNS = {
  A: 'decision_type',     // Tipo de Decisão
  B: 'product_name',      // Assunto
  C: 'client_name',       // Nome do Cliente
  D: 'process_number',    // Número do Processo
  E: 'court',             // Tribunal
  F: 'court_division',    // Vara/Câmara
  G: 'decision_date',     // Data
  H: 'decision_link',     // Link
  I: 'observation',       // Observação
  J: 'was_posted',        // Postado
  K: 'evaluation_requested', // Avaliação Pedida
  L: 'was_evaluated',     // Avaliado
};

async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get('MICROSOFT_CLIENT_ID');
  const clientSecret = Deno.env.get('MICROSOFT_CLIENT_SECRET');
  const tenantId = Deno.env.get('MICROSOFT_TENANT_ID');

  if (!clientId || !clientSecret || !tenantId) {
    throw new Error('Microsoft credentials not configured');
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  
  const params = new URLSearchParams();
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);
  params.append('scope', 'https://graph.microsoft.com/.default');
  params.append('grant_type', 'client_credentials');

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Token error:', error);
    throw new Error('Failed to get access token');
  }

  const data = await response.json();
  return data.access_token;
}

async function getSiteAndDriveInfo(accessToken: string): Promise<{ siteId: string; driveId: string; itemId: string }> {
  // Get site - searching for Jurídico
  console.log('Searching for Jurídico site...');
  const sitesResponse = await fetch(
    'https://graph.microsoft.com/v1.0/sites?search=Jurídico',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  
  if (!sitesResponse.ok) {
    const error = await sitesResponse.text();
    console.error('Sites search error:', error);
    throw new Error('Failed to get sites');
  }
  
  const sitesData = await sitesResponse.json();
  console.log('Sites found:', sitesData.value?.map((s: any) => s.displayName));
  
  const site = sitesData.value.find((s: any) => 
    s.displayName?.toLowerCase().includes('jurídico') || 
    s.displayName?.toLowerCase().includes('juridico') ||
    s.name?.toLowerCase().includes('jurídico') ||
    s.name?.toLowerCase().includes('juridico')
  );
  
  if (!site) {
    console.error('Available sites:', sitesData.value?.map((s: any) => ({ name: s.name, displayName: s.displayName })));
    throw new Error('Jurídico site not found');
  }

  console.log('Found site:', site.displayName, 'ID:', site.id);

  // Get drives
  const drivesResponse = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${site.id}/drives`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  
  if (!drivesResponse.ok) {
    throw new Error('Failed to get drives');
  }
  
  const drivesData = await drivesResponse.json();
  console.log('Drives found:', drivesData.value?.map((d: any) => d.name));
  
  const drive = drivesData.value.find((d: any) => d.name === 'Documentos' || d.name === 'Documents');
  
  if (!drive) {
    throw new Error('Documents drive not found');
  }

  console.log('Using drive:', drive.name, 'ID:', drive.id);

  // First try to find the file in the Operacional folder
  console.log('Searching for file in Operacional folder...');
  let file = null;
  
  try {
    // Try to access Operacional folder directly
    const folderResponse = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${drive.id}/root:/Operacional:/children`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    
    if (folderResponse.ok) {
      const folderData = await folderResponse.json();
      console.log('Files in Operacional folder:', folderData.value?.map((f: any) => f.name));
      
      file = folderData.value.find((f: any) => 
        f.name?.includes('Planilha de Decisões Favoráveis') && f.name?.endsWith('.xlsx')
      );
    }
  } catch (e) {
    console.log('Operacional folder not found directly, searching...');
  }

  // If not found in Operacional, search globally
  if (!file) {
    console.log('Searching for file globally...');
    const searchResponse = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${drive.id}/root/search(q='Planilha de Decisões Favoráveis')`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    
    if (!searchResponse.ok) {
      const error = await searchResponse.text();
      console.error('Search error:', error);
      throw new Error('Failed to search for file');
    }
    
    const searchData = await searchResponse.json();
    console.log('Search results:', searchData.value?.map((f: any) => f.name));
    
    file = searchData.value.find((f: any) => 
      f.name?.includes('Planilha de Decisões Favoráveis') && f.name?.endsWith('.xlsx')
    );
  }
  
  if (!file) {
    throw new Error('Excel file "Planilha de Decisões Favoráveis.xlsx" not found');
  }

  console.log('Found file:', file.name, 'ID:', file.id);

  return {
    siteId: site.id,
    driveId: drive.id,
    itemId: file.id,
  };
}

async function getWorkbookData(accessToken: string, driveId: string, itemId: string): Promise<any[][]> {
  // Get used range from first worksheet
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/workbook/worksheets/Sheet1/usedRange`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    // Try with different sheet name
    const response2 = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/workbook/worksheets/Planilha1/usedRange`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    
    if (!response2.ok) {
      const error = await response2.text();
      console.error('Error getting workbook data:', error);
      throw new Error('Failed to get workbook data');
    }
    
    const data = await response2.json();
    return data.values || [];
  }

  const data = await response.json();
  return data.values || [];
}

async function updateWorkbookData(
  accessToken: string, 
  driveId: string, 
  itemId: string, 
  rows: any[][]
): Promise<void> {
  const range = `A2:L${rows.length + 1}`;
  
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/workbook/worksheets/Sheet1/range(address='${range}')`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: rows }),
    }
  );

  if (!response.ok) {
    // Try with different sheet name
    const response2 = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/workbook/worksheets/Planilha1/range(address='${range}')`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: rows }),
      }
    );
    
    if (!response2.ok) {
      const error = await response2.text();
      console.error('Error updating workbook:', error);
      throw new Error('Failed to update workbook');
    }
  }
}

function parseExcelDate(excelValue: any): string | null {
  if (!excelValue) return null;
  
  // If it's a number (Excel serial date)
  if (typeof excelValue === 'number') {
    const date = new Date((excelValue - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }
  
  // If it's a string, try to parse it
  if (typeof excelValue === 'string') {
    const parts = excelValue.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const year = parseInt(parts[2]);
      const date = new Date(year, month, day);
      return date.toISOString().split('T')[0];
    }
    
    // Try ISO format
    const date = new Date(excelValue);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  
  return null;
}

function parseBoolean(value: any): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    return lower === 'sim' || lower === 'yes' || lower === 'true' || lower === 'x' || lower === '1';
  }
  return false;
}

function formatDateForExcel(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
}

function formatBooleanForExcel(value: boolean): string {
  return value ? 'Sim' : 'Não';
}

function mapDecisionType(value: string): string {
  const map: Record<string, string> = {
    'sentenca': 'Sentença',
    'liminar': 'Liminar',
    'acordao': 'Acórdão',
    'decisao_interlocutoria': 'Decisão Interlocutória',
  };
  return map[value] || value;
}

function reverseMapDecisionType(value: string): string {
  const map: Record<string, string> = {
    'Sentença': 'sentenca',
    'Liminar': 'liminar',
    'Acórdão': 'acordao',
    'Decisão Interlocutória': 'decisao_interlocutoria',
  };
  return map[value] || value.toLowerCase().replace(/[^a-z]/g, '_');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid user' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { action } = body;

    console.log(`Processing action: ${action}`);

    // Get Microsoft access token
    const accessToken = await getAccessToken();
    
    // Get site and file info
    const { driveId, itemId } = await getSiteAndDriveInfo(accessToken);

    if (action === 'sync-from-teams') {
      // Read data from Excel
      const excelData = await getWorkbookData(accessToken, driveId, itemId);
      console.log(`Read ${excelData.length} rows from Excel`);

      if (excelData.length <= 1) {
        return new Response(
          JSON.stringify({ success: true, message: 'No data to sync' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Skip header row
      const dataRows = excelData.slice(1);

      // Get existing decisions
      const { data: existingDecisions } = await supabase
        .from('favorable_decisions')
        .select('*');

      // Process each row from Excel
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        if (!row[0] && !row[2]) continue; // Skip empty rows

        const decisionDate = parseExcelDate(row[6]);
        if (!decisionDate) continue;

        const decisionData = {
          decision_type: reverseMapDecisionType(row[0] || ''),
          product_name: row[1] || '',
          client_name: row[2] || '',
          process_number: row[3] || null,
          court: row[4] || null,
          court_division: row[5] || null,
          decision_date: decisionDate,
          decision_link: row[7] || null,
          observation: row[8] || null,
          was_posted: parseBoolean(row[9]),
          evaluation_requested: parseBoolean(row[10]),
          was_evaluated: parseBoolean(row[11]),
          teams_row_index: i + 2, // Row index in Excel (1-indexed, skip header)
          created_by: user.id,
        };

        // Check if exists by matching key fields
        const existing = existingDecisions?.find(d => 
          d.client_name === decisionData.client_name &&
          d.decision_date === decisionData.decision_date &&
          d.product_name === decisionData.product_name
        );

        if (existing) {
          // Update existing
          await supabase
            .from('favorable_decisions')
            .update({
              ...decisionData,
              created_by: existing.created_by, // Keep original creator
            })
            .eq('id', existing.id);
        } else {
          // Insert new
          await supabase
            .from('favorable_decisions')
            .insert(decisionData);
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: `Synced ${dataRows.length} rows from Teams` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'sync-to-teams') {
      // Get all decisions from database
      const { data: decisions, error } = await supabase
        .from('favorable_decisions')
        .select('*')
        .order('decision_date', { ascending: false });

      if (error) throw error;

      // Convert to Excel format
      const excelRows = decisions.map((d: any) => [
        mapDecisionType(d.decision_type),
        d.product_name || '',
        d.client_name || '',
        d.process_number || '',
        d.court || '',
        d.court_division || '',
        formatDateForExcel(d.decision_date),
        d.decision_link || '',
        d.observation || '',
        formatBooleanForExcel(d.was_posted),
        formatBooleanForExcel(d.evaluation_requested),
        formatBooleanForExcel(d.was_evaluated),
      ]);

      // Update Excel with all data
      if (excelRows.length > 0) {
        await updateWorkbookData(accessToken, driveId, itemId, excelRows);
      }

      return new Response(
        JSON.stringify({ success: true, message: `Synced ${decisions.length} decisions to Teams` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error in favorable-decisions-sync:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
