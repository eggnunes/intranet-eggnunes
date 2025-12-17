import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Site {
  id: string;
  displayName: string;
  webUrl: string;
}

interface Drive {
  id: string;
  name: string;
  driveType: string;
}

interface UploadResult {
  success: boolean;
  fileId?: string;
  webUrl?: string;
  error?: string;
}

export function useTeamsUpload() {
  const [uploading, setUploading] = useState(false);
  const [sites, setSites] = useState<Site[]>([]);
  const [drives, setDrives] = useState<Drive[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [loadingDrives, setLoadingDrives] = useState(false);

  // Sites permitidos
  const ALLOWED_SITES = ['Comercial', 'Jurídico', 'Egg Nunes Advogados Associados'];

  const callTeamsApi = async (action: string, params: Record<string, any> = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Usuário não autenticado');

    const { data, error } = await supabase.functions.invoke('microsoft-teams', {
      body: { action, ...params },
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const loadSites = async () => {
    setLoadingSites(true);
    try {
      const data = await callTeamsApi('list-sites');
      const allSites = data.value || [];
      // Filtrar apenas sites permitidos
      const filteredSites = allSites.filter((site: Site) => 
        ALLOWED_SITES.some(allowed => 
          site.displayName?.toLowerCase().includes(allowed.toLowerCase())
        )
      );
      setSites(filteredSites);
      return filteredSites;
    } catch (error) {
      console.error('Error loading sites:', error);
      throw error;
    } finally {
      setLoadingSites(false);
    }
  };

  const loadDrives = async (siteId: string) => {
    setLoadingDrives(true);
    try {
      const data = await callTeamsApi('list-drives', { siteId });
      const drivesList = data.value || [];
      setDrives(drivesList);
      return drivesList;
    } catch (error) {
      console.error('Error loading drives:', error);
      throw error;
    } finally {
      setLoadingDrives(false);
    }
  };

  const uploadFile = async (
    driveId: string,
    fileName: string,
    fileContent: string, // Base64 encoded
    folderId?: string
  ): Promise<UploadResult> => {
    setUploading(true);
    try {
      const result = await callTeamsApi('upload', {
        driveId,
        fileName,
        fileContent,
        folderId,
      });

      return {
        success: true,
        fileId: result.id,
        webUrl: result.webUrl,
      };
    } catch (error: any) {
      console.error('Error uploading file:', error);
      return {
        success: false,
        error: error.message || 'Erro ao fazer upload do arquivo',
      };
    } finally {
      setUploading(false);
    }
  };

  const createFolder = async (
    driveId: string,
    folderName: string,
    parentFolderId?: string
  ): Promise<{ success: boolean; folderId?: string; error?: string }> => {
    try {
      const result = await callTeamsApi('create-folder', {
        driveId,
        folderName,
        folderId: parentFolderId,
      });

      return {
        success: true,
        folderId: result.id,
      };
    } catch (error: any) {
      console.error('Error creating folder:', error);
      return {
        success: false,
        error: error.message || 'Erro ao criar pasta',
      };
    }
  };

  const listItems = async (driveId: string, folderId?: string) => {
    try {
      const data = await callTeamsApi('list-items', { driveId, folderId });
      return data.value || [];
    } catch (error) {
      console.error('Error listing items:', error);
      throw error;
    }
  };

  // Helper para converter jsPDF para base64
  const pdfToBase64 = (pdf: any): string => {
    const pdfOutput = pdf.output('arraybuffer');
    const uint8Array = new Uint8Array(pdfOutput);
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
  };

  return {
    uploading,
    sites,
    drives,
    loadingSites,
    loadingDrives,
    loadSites,
    loadDrives,
    uploadFile,
    createFolder,
    listItems,
    pdfToBase64,
  };
}
