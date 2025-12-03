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
  text?: string;
  isLegible: boolean;
  legibilityScore: number;
  suggestedName: string;
  warnings: string[];
}

// Document type mapping for auto-naming
const DOCUMENT_TYPE_NAMES: Record<string, string> = {
  'relatorio_medico': 'Relatorio_Medico',
  'relatório médico': 'Relatorio_Medico',
  'laudo_medico': 'Laudo_Medico',
  'laudo médico': 'Laudo_Medico',
  'atestado': 'Atestado',
  'atestado_medico': 'Atestado_Medico',
  'receita': 'Receita_Medica',
  'receita_medica': 'Receita_Medica',
  'procuracao': 'Procuracao',
  'procuração': 'Procuracao',
  'contrato': 'Contrato',
  'rg': 'RG',
  'cpf': 'CPF',
  'cnh': 'CNH',
  'identidade': 'Documento_Identidade',
  'comprovante': 'Comprovante',
  'comprovante_residencia': 'Comprovante_Residencia',
  'nota_fiscal': 'Nota_Fiscal',
  'boleto': 'Boleto',
  'certidao': 'Certidao',
  'certidão': 'Certidao',
  'declaracao': 'Declaracao',
  'declaração': 'Declaracao',
  'exame': 'Exame',
  'resultado_exame': 'Resultado_Exame',
  'termo': 'Termo',
  'peticao': 'Peticao',
  'petição': 'Peticao',
  'sentenca': 'Sentenca',
  'sentença': 'Sentenca',
  'documento': 'Documento',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { files, mergeAll = false } = await req.json();

    if (!files || !Array.isArray(files) || files.length === 0) {
      throw new Error('Nenhum arquivo fornecido');
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      throw new Error('API Key não configurada no servidor');
    }

    console.log(`Processando ${files.length} arquivos com Lovable AI`);

    // Analyze each file
    const analyses: ImageAnalysis[] = [];
    const legibilityWarnings: string[] = [];
    
    for (const file of files) {
      const analysis = await analyzeImage(file, apiKey);
      analyses.push(analysis);
      console.log(`Arquivo ${file.name} analisado:`, {
        type: analysis.documentType,
        rotation: analysis.rotation,
        legible: analysis.isLegible,
        suggestedName: analysis.suggestedName,
      });
      
      // Collect legibility warnings
      if (!analysis.isLegible || analysis.legibilityScore < 0.7) {
        legibilityWarnings.push(`${file.name}: ${analysis.warnings.join(', ')}`);
      }
    }

    // Group documents by type or merge all
    const groupedDocs = mergeAll 
      ? [{ type: 'documento_completo', files, analyses }]
      : groupDocumentsByType(files, analyses);
    console.log(`Agrupados em ${groupedDocs.length} documentos`);

    // Generate PDFs
    const documents = [];
    
    for (let i = 0; i < groupedDocs.length; i++) {
      const group = groupedDocs[i];
      const pdfDoc = await PDFDocument.create();
      
      for (let j = 0; j < group.files.length; j++) {
        const file = group.files[j];
        const analysis = group.analyses[j];
        
        // Process PDF files - extract pages and rotate
        if (file.type === 'application/pdf') {
          console.log(`Processando PDF: ${file.name}`);
          try {
            const pdfBytes = Uint8Array.from(atob(file.data), c => c.charCodeAt(0));
            const sourcePdf = await PDFDocument.load(pdfBytes);
            
            const pageCount = sourcePdf.getPageCount();
            console.log(`PDF ${file.name} tem ${pageCount} página(s)`);
            
            for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
              const [copiedPage] = await pdfDoc.copyPages(sourcePdf, [pageIndex]);
              
              const rotation = analysis.rotation || 0;
              if (rotation !== 0) {
                console.log(`Aplicando rotação de ${rotation}° na página ${pageIndex + 1}`);
                copiedPage.setRotation(degrees(rotation));
              }
              
              pdfDoc.addPage(copiedPage);
            }
          } catch (e) {
            console.error(`Erro ao processar PDF ${file.name}:`, e);
          }
          continue;
        }
        
        // Decode base64 for images
        const imageBytes = Uint8Array.from(atob(file.data), c => c.charCodeAt(0));
        
        let pdfImage;
        try {
          if (file.type.includes('png')) {
            pdfImage = await pdfDoc.embedPng(imageBytes);
          } else {
            pdfImage = await pdfDoc.embedJpg(imageBytes);
          }
        } catch (e) {
          console.error(`Erro ao processar imagem ${file.name}:`, e);
          try {
            pdfImage = await pdfDoc.embedJpg(imageBytes);
          } catch (e2) {
            console.error(`Falha ao processar ${file.name} como JPEG também`);
            continue;
          }
        }
        
        const imgWidth = pdfImage.width;
        const imgHeight = pdfImage.height;
        const rotation = analysis.rotation || 0;
        
        let page;
        if (rotation === 90 || rotation === 270) {
          page = pdfDoc.addPage([imgHeight, imgWidth]);
        } else {
          page = pdfDoc.addPage([imgWidth, imgHeight]);
        }
        
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
      
      if (pdfDoc.getPageCount() === 0) {
        console.log(`Grupo ${group.type} não tem páginas válidas, pulando`);
        continue;
      }
      
      const pdfBytes = await pdfDoc.save();
      
      let pdfBase64 = '';
      const chunkSize = 8192;
      for (let k = 0; k < pdfBytes.length; k += chunkSize) {
        const chunk = pdfBytes.slice(k, k + chunkSize);
        pdfBase64 += String.fromCharCode(...chunk);
      }
      pdfBase64 = btoa(pdfBase64);
      
      // Generate auto-named filename
      const suggestedName = group.analyses[0]?.suggestedName || group.type;
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const fileName = `${suggestedName}_${timestamp}_${i + 1}.pdf`;
      
      documents.push({
        name: fileName,
        url: `data:application/pdf;base64,${pdfBase64}`,
        pageCount: pdfDoc.getPageCount(),
        documentType: group.type,
        legibilityWarnings: group.analyses
          .filter(a => !a.isLegible || a.legibilityScore < 0.7)
          .flatMap(a => a.warnings),
      });
    }

    console.log(`${documents.length} PDFs gerados com sucesso`);

    return new Response(
      JSON.stringify({ 
        documents,
        legibilityWarnings: legibilityWarnings.length > 0 ? legibilityWarnings : undefined,
      }),
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
  const isImage = image.type.startsWith('image/');
  const isPDF = image.type === 'application/pdf';
  
  if (!isImage && !isPDF) {
    console.log(`Arquivo ${image.name} não é imagem nem PDF (${image.type}), usando valores padrão`);
    return {
      rotation: 0,
      documentType: 'documento',
      confidence: 0.5,
      text: '',
      isLegible: true,
      legibilityScore: 1.0,
      suggestedName: 'Documento',
      warnings: [],
    };
  }

  if (isImage) {
    const supportedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!supportedTypes.includes(image.type)) {
      console.log(`Tipo de imagem ${image.type} não suportado, usando valores padrão`);
      return {
        rotation: 0,
        documentType: 'documento',
        confidence: 0.5,
        text: '',
        isLegible: true,
        legibilityScore: 1.0,
        suggestedName: 'Documento',
        warnings: [],
      };
    }
  }

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
          content: `Você é um especialista em análise de documentos jurídicos e médicos. Analise a imagem e determine:

1. ROTAÇÃO: Se o documento está rotacionado e em quantos graus (0, 90, 180, 270). Considere a orientação do texto.

2. TIPO DE DOCUMENTO: Identifique precisamente o tipo (exemplos: relatório médico, laudo médico, atestado, procuração, contrato, RG, CPF, CNH, comprovante de residência, nota fiscal, certidão, declaração, exame, petição, sentença, termo).

3. LEGIBILIDADE: Avalie se o documento é legível considerando:
   - Qualidade da imagem (foco, nitidez)
   - Contraste entre texto e fundo
   - Se há partes cortadas ou obscurecidas
   - Se o texto é lido corretamente
   Dê uma pontuação de 0 a 1 (1 = perfeitamente legível, 0 = ilegível)

4. TEXTO: Extraia o texto principal visível.

5. ALERTAS: Liste problemas específicos (ex: "imagem borrada", "texto cortado", "baixo contraste", "documento de cabeça para baixo").

Responda APENAS em formato JSON válido:
{
  "rotation": número (0, 90, 180 ou 270),
  "documentType": string (tipo identificado),
  "confidence": número 0-1,
  "text": string (texto extraído),
  "isLegible": boolean,
  "legibilityScore": número 0-1,
  "warnings": array de strings (problemas encontrados)
}`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analise este documento e retorne o JSON com rotação, tipo, legibilidade e alertas.'
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
  
  // Extract JSON from response - handle multi-line JSON
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.warn('Resposta sem JSON válido, usando valores padrão');
    return {
      rotation: 0,
      documentType: 'documento',
      confidence: 0.5,
      text: '',
      isLegible: true,
      legibilityScore: 0.5,
      suggestedName: 'Documento',
      warnings: ['Não foi possível analisar o documento automaticamente'],
    };
  }

  try {
    const result = JSON.parse(jsonMatch[0]);
    
    // Generate suggested name based on document type
    const docType = (result.documentType || 'documento').toLowerCase().replace(/\s+/g, '_');
    const suggestedName = DOCUMENT_TYPE_NAMES[docType] || 
                          DOCUMENT_TYPE_NAMES[result.documentType?.toLowerCase()] ||
                          formatDocumentTypeName(result.documentType || 'Documento');
    
    return {
      rotation: result.rotation || 0,
      documentType: result.documentType || 'documento',
      confidence: result.confidence || 0.5,
      text: result.text || '',
      isLegible: result.isLegible !== false,
      legibilityScore: result.legibilityScore || 0.5,
      suggestedName,
      warnings: result.warnings || [],
    };
  } catch (e) {
    console.error('Erro ao fazer parse do JSON:', e);
    return {
      rotation: 0,
      documentType: 'documento',
      confidence: 0.5,
      text: '',
      isLegible: true,
      legibilityScore: 0.5,
      suggestedName: 'Documento',
      warnings: ['Erro ao processar análise do documento'],
    };
  }
}

function formatDocumentTypeName(docType: string): string {
  return docType
    .split(/[\s_-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('_');
}

function groupDocumentsByType(
  files: ImageData[],
  analyses: ImageAnalysis[]
): Array<{ type: string; files: ImageData[]; analyses: ImageAnalysis[] }> {
  const groups: Map<string, { files: ImageData[]; analyses: ImageAnalysis[] }> = new Map();
  
  files.forEach((file, index) => {
    const analysis = analyses[index];
    const docType = analysis.documentType.toLowerCase().replace(/\s+/g, '_');
    
    if (!groups.has(docType)) {
      groups.set(docType, { files: [], analyses: [] });
    }
    const group = groups.get(docType)!;
    group.files.push(file);
    group.analyses.push(analysis);
  });

  return Array.from(groups.entries()).map(([type, data]) => ({
    type,
    files: data.files,
    analyses: data.analyses
  }));
}
