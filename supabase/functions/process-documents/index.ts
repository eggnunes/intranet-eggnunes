import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { PDFDocument, degrees } from "npm:pdf-lib@1.17.1";

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
  text?: string; // OCR text
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { images, mergeAll = false } = await req.json();

    if (!images || !Array.isArray(images) || images.length === 0) {
      throw new Error('Nenhuma imagem fornecida');
    }

    // Usar Lovable AI (Google Gemini) - provisionado automaticamente
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      throw new Error('API Key não configurada no servidor');
    }

    console.log(`Processando ${images.length} imagens com Lovable AI`);

    // Analisar cada imagem com GPT-4 Vision
    const analyses: ImageAnalysis[] = [];
    
    for (const image of images) {
      const analysis = await analyzeImage(image, apiKey);
      analyses.push(analysis);
      console.log(`Imagem ${image.name} analisada:`, analysis);
    }

    // Agrupar documentos por tipo ou mesclar tudo
    const groupedDocs = mergeAll 
      ? [{ type: 'documento_completo', images, analyses }]
      : groupDocumentsByType(images, analyses);
    console.log(`Agrupados em ${groupedDocs.length} documentos`);

    // Gerar PDFs reais
    const documents = [];
    
    for (let i = 0; i < groupedDocs.length; i++) {
      const group = groupedDocs[i];
      const pdfDoc = await PDFDocument.create();
      
      for (let j = 0; j < group.images.length; j++) {
        const image = group.images[j];
        const analysis = group.analyses[j];
        
        // Decodificar base64
        const imageBytes = Uint8Array.from(atob(image.data), c => c.charCodeAt(0));
        
        // Adicionar imagem ao PDF
        let pdfImage;
        try {
          if (image.type.includes('png')) {
            pdfImage = await pdfDoc.embedPng(imageBytes);
          } else {
            pdfImage = await pdfDoc.embedJpg(imageBytes);
          }
        } catch (e) {
          console.error(`Erro ao processar imagem ${image.name}:`, e);
          // Tentar como JPEG se PNG falhar
          try {
            pdfImage = await pdfDoc.embedJpg(imageBytes);
          } catch (e2) {
            console.error(`Falha ao processar ${image.name} como JPEG também`);
            continue;
          }
        }
        
        // Determinar dimensões e rotação
        const imgWidth = pdfImage.width;
        const imgHeight = pdfImage.height;
        const rotation = analysis.rotation || 0;
        
        // Criar página com dimensões corretas considerando rotação
        let page;
        if (rotation === 90 || rotation === 270) {
          page = pdfDoc.addPage([imgHeight, imgWidth]);
        } else {
          page = pdfDoc.addPage([imgWidth, imgHeight]);
        }
        
        // Desenhar imagem com rotação apropriada
        const { width: pageWidth, height: pageHeight } = page.getSize();
        
        if (rotation === 0) {
          page.drawImage(pdfImage, {
            x: 0,
            y: 0,
            width: pageWidth,
            height: pageHeight,
          });
        } else if (rotation === 90) {
          page.drawImage(pdfImage, {
            x: 0,
            y: pageHeight,
            width: pageHeight,
            height: pageWidth,
            rotate: degrees(-90),
          });
        } else if (rotation === 180) {
          page.drawImage(pdfImage, {
            x: pageWidth,
            y: pageHeight,
            width: pageWidth,
            height: pageHeight,
            rotate: degrees(-180),
          });
        } else if (rotation === 270) {
          page.drawImage(pdfImage, {
            x: pageWidth,
            y: 0,
            width: pageHeight,
            height: pageWidth,
            rotate: degrees(-270),
          });
        }
      }
      
      // Salvar PDF
      const pdfBytes = await pdfDoc.save();
      const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));
      
      documents.push({
        name: `${group.type}_${i + 1}.pdf`,
        url: `data:application/pdf;base64,${pdfBase64}`,
        pageCount: group.images.length,
      });
    }

    console.log(`${documents.length} PDFs gerados com sucesso`);

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
  // Verificar se é uma imagem válida para análise
  const isImage = image.type.startsWith('image/');
  
  if (!isImage) {
    // Para arquivos não-imagem (PDF, DOCX, etc), retornar valores padrão
    console.log(`Arquivo ${image.name} não é imagem (${image.type}), usando valores padrão`);
    return {
      rotation: 0,
      documentType: 'documento',
      confidence: 0.5,
      text: ''
    };
  }

  // Validar tipo MIME de imagem suportado
  const supportedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!supportedTypes.includes(image.type)) {
    console.log(`Tipo de imagem ${image.type} não suportado, usando valores padrão`);
    return {
      rotation: 0,
      documentType: 'documento',
      confidence: 0.5,
      text: ''
    };
  }

  // Usar Lovable AI (Google Gemini 2.5 Flash) para análise rápida
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: 'Você é um especialista em análise de documentos jurídicos e médicos. Analise a imagem e determine: 1) Se está rotacionada e em quantos graus (0, 90, 180, 270), 2) Que tipo de documento é (relatório médico, procuração, contrato, receita, atestado, etc), 3) Extraia todo o texto visível na imagem. Responda APENAS em formato JSON válido com as chaves: rotation (número), documentType (string), confidence (número 0-1), text (string com o texto extraído).'
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analise este documento e retorne o JSON solicitado com a rotação correta, tipo de documento e texto extraído.'
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
    console.error('Erro na Lovable AI:', error);
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
      confidence: 0.5,
      text: ''
    };
  }

  const result = JSON.parse(jsonMatch[0]);
  return {
    rotation: result.rotation || 0,
    documentType: result.documentType || 'documento',
    confidence: result.confidence || 0.5,
    text: result.text || ''
  };
}

function groupDocumentsByType(
  images: ImageData[],
  analyses: ImageAnalysis[]
): Array<{ type: string; images: ImageData[]; analyses: ImageAnalysis[] }> {
  const groups: Map<string, { images: ImageData[]; analyses: ImageAnalysis[] }> = new Map();
  
  images.forEach((image, index) => {
    const analysis = analyses[index];
    const docType = analysis.documentType.toLowerCase().replace(/\s+/g, '_');
    
    if (!groups.has(docType)) {
      groups.set(docType, { images: [], analyses: [] });
    }
    const group = groups.get(docType)!;
    group.images.push(image);
    group.analyses.push(analysis);
  });

  return Array.from(groups.entries()).map(([type, data]) => ({
    type,
    images: data.images,
    analyses: data.analyses
  }));
}
