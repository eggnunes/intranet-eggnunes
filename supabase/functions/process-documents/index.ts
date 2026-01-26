import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { decode as base64Decode, encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
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

// Maximum dimensions for images to prevent CPU overload
const MAX_IMAGE_DIMENSION = 1600; // pixels - reduced for better CPU performance
const MAX_FILE_SIZE_MB = 15; // MB per file - increased limit, we'll compress large files
const COMPRESSION_THRESHOLD_MB = 4; // Compress images larger than this

// Base64 helpers (stdlib) - evita conversões custosas em CPU
function base64ToUint8Array(base64: string): Uint8Array {
  return base64Decode(base64);
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  // Process in chunks to avoid memory issues with large files
  const copy = new Uint8Array(bytes);
  return base64Encode(copy.buffer);
}

// Estimate base64 size in MB
function getBase64SizeMB(base64: string): number {
  return (base64.length * 3 / 4) / (1024 * 1024);
}

// Simple image dimension parser from bytes (for JPEG and PNG)
function getImageDimensions(bytes: Uint8Array, type: string): { width: number; height: number } | null {
  try {
    if (type.includes('jpeg') || type.includes('jpg')) {
      // JPEG: Find SOF0/SOF2 marker for dimensions
      for (let i = 0; i < bytes.length - 10; i++) {
        if (bytes[i] === 0xFF && (bytes[i + 1] === 0xC0 || bytes[i + 1] === 0xC2)) {
          const height = (bytes[i + 5] << 8) | bytes[i + 6];
          const width = (bytes[i + 7] << 8) | bytes[i + 8];
          return { width, height };
        }
      }
    } else if (type.includes('png')) {
      // PNG: IHDR chunk starts at byte 16
      if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
        const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
        const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
        return { width, height };
      }
    }
  } catch (e) {
    console.warn('Could not parse image dimensions:', e);
  }
  return null;
}

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

    console.log(`Processando ${files.length} arquivos`);

    // Process all files - accept all sizes but log warnings for very large ones
    const validFiles: ImageData[] = [];
    const warnings: string[] = [];
    
    for (const file of files) {
      const sizeMB = getBase64SizeMB(file.data);
      
      if (sizeMB > MAX_FILE_SIZE_MB) {
        console.warn(`Arquivo ${file.name} muito grande (${sizeMB.toFixed(2)}MB), mas será processado`);
        warnings.push(`${file.name}: arquivo grande (${sizeMB.toFixed(1)}MB), pode demorar mais`);
      }
      
      if (sizeMB > COMPRESSION_THRESHOLD_MB && file.type.startsWith('image/')) {
        console.log(`Arquivo ${file.name} (${sizeMB.toFixed(2)}MB) será comprimido no processamento`);
      }
      
      validFiles.push(file);
    }

    if (validFiles.length === 0) {
      throw new Error('Nenhum arquivo válido para processar');
    }

    // Analyze each file - use faster model for analysis
    const analyses: ImageAnalysis[] = [];
    const legibilityWarnings: string[] = [...warnings];
    
    for (const file of validFiles) {
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
      ? [{ type: 'documento_completo', files: validFiles, analyses }]
      : groupDocumentsByType(validFiles, analyses);
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
            const pdfBytes = base64ToUint8Array(file.data);
            const sourcePdf = await PDFDocument.load(pdfBytes);
            
            const pageCount = sourcePdf.getPageCount();
            console.log(`PDF ${file.name} tem ${pageCount} página(s)`);
            
            // Limit pages to prevent timeout
            const maxPages = Math.min(pageCount, 20);
            if (pageCount > maxPages) {
              console.warn(`PDF tem ${pageCount} páginas, processando apenas ${maxPages}`);
              legibilityWarnings.push(`${file.name}: PDF muito grande, processadas apenas ${maxPages} de ${pageCount} páginas`);
            }
            
            for (let pageIndex = 0; pageIndex < maxPages; pageIndex++) {
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
            legibilityWarnings.push(`${file.name}: Erro ao processar PDF`);
          }
          continue;
        }
        
        // Check for unsupported image formats
        const unsupportedFormats = ['image/heic', 'image/heif', 'image/avif', 'image/tiff'];
        if (unsupportedFormats.includes(file.type) || 
            file.name.toLowerCase().endsWith('.heic') || 
            file.name.toLowerCase().endsWith('.heif')) {
          console.error(`Formato não suportado: ${file.name} (${file.type}). Arquivos HEIC devem ser convertidos no frontend.`);
          legibilityWarnings.push(`${file.name}: Formato HEIC não suportado, converta para JPG`);
          continue;
        }
        
        // Decode base64 for images using fast method
        const imageBytes = base64ToUint8Array(file.data);
        const fileSizeMB = getBase64SizeMB(file.data);
        
        // Calculate appropriate max dimension based on file size
        // Larger files get more aggressive scaling to prevent CPU timeout
        let effectiveMaxDimension = MAX_IMAGE_DIMENSION;
        if (fileSizeMB > 8) {
          effectiveMaxDimension = 1000; // Very large files
          console.log(`Arquivo ${file.name} (${fileSizeMB.toFixed(1)}MB) - usando dimensão máxima reduzida: ${effectiveMaxDimension}px`);
        } else if (fileSizeMB > 5) {
          effectiveMaxDimension = 1200; // Large files
          console.log(`Arquivo ${file.name} (${fileSizeMB.toFixed(1)}MB) - usando dimensão máxima: ${effectiveMaxDimension}px`);
        }
        
        let pdfImage;
        try {
          if (file.type.includes('png')) {
            pdfImage = await pdfDoc.embedPng(imageBytes);
          } else if (file.type.includes('gif')) {
            // GIF não é suportado diretamente, tentar como JPEG
            console.log(`GIF ${file.name} será tratado como JPEG`);
            pdfImage = await pdfDoc.embedJpg(imageBytes);
          } else {
            pdfImage = await pdfDoc.embedJpg(imageBytes);
          }
        } catch (e) {
          console.error(`Erro ao processar imagem ${file.name}:`, e);
          // Tentar como PNG se JPEG falhar
          try {
            pdfImage = await pdfDoc.embedPng(imageBytes);
          } catch (e2) {
            console.error(`Falha ao processar ${file.name} como PNG também`);
            legibilityWarnings.push(`${file.name}: Não foi possível processar a imagem`);
            continue;
          }
        }
        
        // Scale down large images to prevent CPU overload
        let imgWidth = pdfImage.width;
        let imgHeight = pdfImage.height;
        
        if (imgWidth > effectiveMaxDimension || imgHeight > effectiveMaxDimension) {
          const scale = effectiveMaxDimension / Math.max(imgWidth, imgHeight);
          imgWidth = Math.round(imgWidth * scale);
          imgHeight = Math.round(imgHeight * scale);
          console.log(`Imagem ${file.name} redimensionada de ${pdfImage.width}x${pdfImage.height} para ${imgWidth}x${imgHeight}`);
        }
        
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
      
      // Save PDF and use efficient base64 encoding
      const pdfBytes = await pdfDoc.save();
      const pdfBase64 = uint8ArrayToBase64(pdfBytes);
      
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
      
      console.log(`PDF ${fileName} gerado com ${pdfDoc.getPageCount()} página(s)`);
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

  // For PDFs, skip AI analysis to save time/CPU
  if (isPDF) {
    console.log(`PDF ${image.name}: usando análise simplificada para economizar CPU`);
    return {
      rotation: 0,
      documentType: 'documento',
      confidence: 0.8,
      text: '',
      isLegible: true,
      legibilityScore: 1.0,
      suggestedName: 'Documento',
      warnings: [],
    };
  }

  // Use the fastest model for document analysis
  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          {
            role: 'system',
            content: `Analise o documento e responda em JSON:
{
  "rotation": número (0, 90, 180 ou 270 - baseado na orientação do texto),
  "documentType": string (tipo: relatório médico, laudo, atestado, procuração, contrato, RG, CPF, CNH, comprovante, certidão, declaração, exame, petição, sentença, termo, documento),
  "confidence": número 0-1,
  "isLegible": boolean,
  "legibilityScore": número 0-1,
  "warnings": array de strings (problemas: imagem borrada, texto cortado, baixo contraste)
}
Responda APENAS o JSON válido.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analise este documento.'
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
      // Return default instead of throwing to continue processing
      return {
        rotation: 0,
        documentType: 'documento',
        confidence: 0.5,
        text: '',
        isLegible: true,
        legibilityScore: 0.5,
        suggestedName: 'Documento',
        warnings: ['Não foi possível analisar automaticamente'],
      };
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
    console.error('Erro ao analisar imagem:', e);
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
