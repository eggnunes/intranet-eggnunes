import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImageData {
  data: string;
  type: string;
  name: string;
}

interface ImageAnalysis {
  rotation: number;
  documentType: string;
  confidence: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { images, apiKey } = await req.json();

    if (!images || !Array.isArray(images) || images.length === 0) {
      throw new Error('Nenhuma imagem fornecida');
    }

    if (!apiKey) {
      throw new Error('API Key não fornecida');
    }

    console.log(`Processando ${images.length} imagens`);

    // Analisar cada imagem com GPT-4 Vision
    const analyses: ImageAnalysis[] = [];
    
    for (const image of images) {
      const analysis = await analyzeImage(image, apiKey);
      analyses.push(analysis);
      console.log(`Imagem ${image.name} analisada:`, analysis);
    }

    // Agrupar documentos por tipo
    const groupedDocs = groupDocumentsByType(images, analyses);
    console.log(`Agrupados em ${groupedDocs.length} documentos`);

    // Gerar PDFs (simulado - em produção usaria biblioteca de PDF)
    const documents = groupedDocs.map((group, index) => ({
      name: `${group.type}_${index + 1}.pdf`,
      url: `data:application/pdf;base64,${btoa('PDF simulado')}`, // Em produção, geraria PDF real
      pageCount: group.images.length,
    }));

    return new Response(
      JSON.stringify({ documents }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro:', error);
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

async function analyzeImage(image: ImageData, apiKey: string): Promise<ImageAnalysis> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content: 'Você é um especialista em análise de documentos jurídicos. Analise a imagem e determine: 1) Se está rotacionada e em quantos graus (0, 90, 180, 270), 2) Que tipo de documento é (relatório médico, procuração, contrato, etc). Responda APENAS em formato JSON com as chaves: rotation (número), documentType (string), confidence (número 0-1).'
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analise este documento e retorne o JSON solicitado.'
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${image.type};base64,${image.data}`
              }
            }
          ]
        }
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Erro na API OpenAI:', error);
    throw new Error(`Erro ao analisar imagem: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  // Extrair JSON da resposta
  const jsonMatch = content.match(/\{[^}]+\}/);
  if (!jsonMatch) {
    console.warn('Resposta sem JSON válido, usando valores padrão');
    return {
      rotation: 0,
      documentType: 'documento',
      confidence: 0.5
    };
  }

  const result = JSON.parse(jsonMatch[0]);
  return {
    rotation: result.rotation || 0,
    documentType: result.documentType || 'documento',
    confidence: result.confidence || 0.5
  };
}

function groupDocumentsByType(
  images: ImageData[],
  analyses: ImageAnalysis[]
): Array<{ type: string; images: ImageData[] }> {
  const groups: Map<string, ImageData[]> = new Map();
  
  images.forEach((image, index) => {
    const analysis = analyses[index];
    const docType = analysis.documentType.toLowerCase().replace(/\s+/g, '_');
    
    if (!groups.has(docType)) {
      groups.set(docType, []);
    }
    groups.get(docType)!.push(image);
  });

  return Array.from(groups.entries()).map(([type, imgs]) => ({
    type,
    images: imgs
  }));
}
