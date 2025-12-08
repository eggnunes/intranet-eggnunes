import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_SHEETS_API_KEY = Deno.env.get('GOOGLE_SHEETS_API_KEY');
    
    if (!GOOGLE_SHEETS_API_KEY) {
      console.error('GOOGLE_SHEETS_API_KEY not configured');
      throw new Error('Google Sheets API Key não configurada');
    }

    const SPREADSHEET_ID = '1FG3o6BL91Ox9WcaqSpmW2Yhl0vBG-V-6iH-1FQztiUM';
    const SHEET_NAME = 'Respostas ao formulário 1';
    
    // Encode sheet name for URL
    const encodedSheetName = encodeURIComponent(SHEET_NAME);
    
    // Fetch all data from the sheet
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodedSheetName}?key=${GOOGLE_SHEETS_API_KEY}`;
    
    console.log('Fetching data from Google Sheets...');
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Sheets API error:', errorText);
      throw new Error(`Erro ao acessar Google Sheets: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.values || data.values.length === 0) {
      console.log('No data found in sheet');
      return new Response(
        JSON.stringify({ clients: [], headers: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // First row is headers
    const headers = data.values[0];
    const rows = data.values.slice(1);

    // Map column indices for easier access
    const columnMap: Record<string, number> = {};
    headers.forEach((header: string, index: number) => {
      columnMap[header.toLowerCase().trim()] = index;
    });

    // Transform rows into client objects
    const clients = rows.map((row: string[], rowIndex: number) => {
      const getValue = (columnName: string) => {
        const index = headers.findIndex((h: string) => 
          h.toLowerCase().includes(columnName.toLowerCase())
        );
        return index >= 0 ? (row[index] || '') : '';
      };

      return {
        id: rowIndex + 1,
        timestamp: row[0] || '',
        nomeCompleto: getValue('nome completo'),
        cpf: getValue('cpf'),
        documentoIdentidade: getValue('documento de identidade'),
        comoConheceu: getValue('como conheceu'),
        dataNascimento: getValue('data de nascimento'),
        estadoCivil: getValue('estado civil'),
        profissao: getValue('profissão'),
        telefone: getValue('telefone'),
        temWhatsapp: getValue('possui whatsapp'),
        email: getValue('e-mail'),
        cep: getValue('cep'),
        cidade: getValue('cidade'),
        rua: getValue('rua'),
        numero: getValue('número da sua residência'),
        complemento: getValue('complemento'),
        bairro: getValue('bairro'),
        estado: getValue('estado fica'),
        nomePai: getValue('nome do pai'),
        nomeMae: getValue('nome da mãe'),
        opcaoPagamento: getValue('opção de pagamento'),
        quantidadeParcelas: getValue('quantidade de parcelas'),
        dataVencimento: getValue('data deseja o vencimento'),
        aposentado: getValue('já se aposentou'),
        previsaoAposentadoria: getValue('previsão da sua aposentadoria'),
        possuiEmprestimo: getValue('empréstimo'),
        doencaGrave: getValue('doença grave'),
        planoSaude: getValue('tem plano de saúde'),
        qualPlanoSaude: getValue('qual é o seu plano de saúde'),
        negativaPlano: getValue('negativa ou atraso'),
        doencaNegativa: getValue('doença/condição'),
        conheceAlguemSituacao: getValue('conhece alguém em situação'),
        conheceAlguemMesmaSituacao: getValue('passando pela mesma situação'),
        telefoneAlternativo: getValue('telefone alternativo'),
      };
    });

    console.log(`Successfully fetched ${clients.length} clients from Google Sheets`);

    return new Response(
      JSON.stringify({ clients, headers }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in google-sheets-integration:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
