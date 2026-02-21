import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-region, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const PJE_API_BASE = 'https://comunicaapi.pje.jus.br/api/v1'

// User-Agent de navegador brasileiro para evitar bloqueio adicional
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/**
 * Faz fetch de forma segura: verifica Content-Type antes de parsear JSON.
 * Detecta respostas HTML (CloudFront bloqueio geográfico) e retorna erro descritivo.
 */
async function fetchJsonSafely(url: string, options: RequestInit = {}): Promise<{ ok: boolean; status: number; data?: any; bloqueioGeografico?: boolean; errorText?: string }> {
  let response: Response
  try {
    response = await fetch(url, options)
  } catch (err: any) {
    return { ok: false, status: 0, errorText: `Falha de rede: ${err.message}` }
  }

  const contentType = response.headers.get('content-type') || ''

  // Detecta resposta HTML — típico do CloudFront bloqueio geográfico
  if (contentType.includes('text/html') || response.status === 403) {
    const html = await response.text()
    const isCloudFront = html.includes('CloudFront') || html.includes('403 ERROR') || response.status === 403
    return {
      ok: false,
      status: response.status,
      bloqueioGeografico: isCloudFront,
      errorText: isCloudFront
        ? 'A API do CNJ está bloqueando requisições desta região. A função está rodando na região sa-east-1 (São Paulo), mas o bloqueio persiste.'
        : `Resposta inesperada (${response.status})`,
    }
  }

  if (!response.ok) {
    const text = await response.text()
    return { ok: false, status: response.status, errorText: text }
  }

  try {
    const data = await response.json()
    return { ok: true, status: response.status, data }
  } catch {
    return { ok: false, status: response.status, errorText: 'Resposta inválida: não é JSON' }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Verify auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { action, filters } = body

    // Verifica conectividade real com a API do CNJ
    if (action === 'check-credentials') {
      const result = await fetchJsonSafely(`${PJE_API_BASE}/comunicacoes?tamanhoPagina=1&pagina=1`, {
        headers: { 'Accept': 'application/json', 'User-Agent': BROWSER_UA },
      })
      if (result.bloqueioGeografico) {
        return new Response(JSON.stringify({ configured: true, accessible: false, reason: 'bloqueio_geografico' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ configured: true, accessible: result.ok }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'search-local') {
      let query = supabase
        .from('publicacoes_dje')
        .select('*')
        .order('data_disponibilizacao', { ascending: false })
        .limit(100)

      if (filters?.numeroProcesso) {
        query = query.ilike('numero_processo', `%${filters.numeroProcesso}%`)
      }
      if (filters?.tribunal) {
        query = query.eq('siglaTribunal', filters.tribunal)
      }
      if (filters?.dataInicio) {
        query = query.gte('data_disponibilizacao', filters.dataInicio)
      }
      if (filters?.dataFim) {
        query = query.lte('data_disponibilizacao', filters.dataFim + 'T23:59:59')
      }
      if (filters?.tipoComunicacao) {
        query = query.eq('tipo_comunicacao', filters.tipoComunicacao)
      }
      if (filters?.nomeAdvogado) {
        query = query.ilike('nome_advogado', `%${filters.nomeAdvogado}%`)
      }

      const { data, error } = await query
      if (error) throw error

      // Get reads for this user
      const pubIds = (data || []).map((p: any) => p.id)
      let reads: any[] = []
      if (pubIds.length > 0) {
        const { data: readsData } = await supabase
          .from('publicacoes_dje_reads')
          .select('publicacao_id')
          .eq('user_id', user.id)
          .in('publicacao_id', pubIds)
        reads = readsData || []
      }

      const readIds = new Set(reads.map((r: any) => r.publicacao_id))
      const enriched = (data || []).map((p: any) => ({
        ...p,
        lida: readIds.has(p.id),
      }))

      return new Response(JSON.stringify({ data: enriched }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'search-api') {
      // Build query params for CNJ API
      const params = new URLSearchParams()

      if (filters?.numeroOAB) params.append('numeroOAB', filters.numeroOAB)
      if (filters?.ufOAB) params.append('ufOAB', filters.ufOAB)
      if (filters?.nomeAdvogado) params.append('nomeAdvogado', filters.nomeAdvogado)
      if (filters?.numeroProcesso) params.append('numeroProcesso', filters.numeroProcesso)
      if (filters?.dataInicio) params.append('dataDisponibilizacaoInicio', filters.dataInicio)
      if (filters?.dataFim) params.append('dataDisponibilizacaoFim', filters.dataFim)
      if (filters?.tribunal) params.append('siglaTribunal', filters.tribunal)
      if (filters?.tipoComunicacao) params.append('tipoComunicacao', filters.tipoComunicacao)

      const pagina = filters?.pagina || 1
      const tamanhoPagina = filters?.tamanhoPagina || 20
      params.append('pagina', String(pagina))
      params.append('tamanhoPagina', String(tamanhoPagina))

      const apiUrl = `${PJE_API_BASE}/comunicacoes?${params.toString()}`
      console.log(`Consultando API CNJ (sa-east-1): ${apiUrl}`)

      const result = await fetchJsonSafely(apiUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': BROWSER_UA,
        },
      })

      if (result.bloqueioGeografico) {
        return new Response(JSON.stringify({
          error: 'A API do CNJ está bloqueando requisições desta região. Mesmo rodando em São Paulo (sa-east-1), o bloqueio persiste. Verifique se a API do CNJ mudou suas restrições.',
          bloqueioGeografico: true,
          details: result.errorText,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (!result.ok) {
        return new Response(JSON.stringify({
          error: `Erro ao consultar API do CNJ (HTTP ${result.status}).`,
          details: result.errorText,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const apiData = result.data
      console.log('API response keys:', Object.keys(apiData))

      const comunicacoes = apiData.items || apiData.comunicacoes || apiData.content || (Array.isArray(apiData) ? apiData : [])
      const totalItems = apiData.totalItems || apiData.total || apiData.totalElements || comunicacoes.length

      // Cache results in database
      const toInsert = (Array.isArray(comunicacoes) ? comunicacoes : []).map((c: any) => {
        const hash = `${c.numeroProcesso || ''}-${c.numeroComunicacao || ''}-${c.dataDisponibilizacao || ''}`
        return {
          numero_processo: c.numeroProcesso || '',
          tribunal: c.nomeOrgao || c.tribunal || '',
          tipo_comunicacao: c.tipoComunicacao || '',
          data_disponibilizacao: c.dataDisponibilizacao || null,
          data_publicacao: c.dataPublicacao || null,
          conteudo: c.conteudo || c.textoConteudo || '',
          destinatario: c.destinatario || c.nomeDestinatario || '',
          meio: c.meio || '',
          nome_advogado: c.nomeAdvogado || filters?.nomeAdvogado || '',
          numero_comunicacao: c.numeroComunicacao || '',
          siglaTribunal: c.siglaTribunal || filters?.tribunal || '',
          hash,
          raw_data: c,
        }
      })

      if (toInsert.length > 0) {
        const { error: upsertError } = await supabase
          .from('publicacoes_dje')
          .upsert(toInsert, { onConflict: 'hash', ignoreDuplicates: true })

        if (upsertError) {
          console.error('Upsert error:', upsertError)
        }
      }

      return new Response(JSON.stringify({
        data: comunicacoes,
        total: totalItems,
        cached: toInsert.length,
        pagina,
        tamanhoPagina,
        hasMore: comunicacoes.length === tamanhoPagina,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'mark-read') {
      const { publicacaoId } = body
      const { error } = await supabase
        .from('publicacoes_dje_reads')
        .upsert({ publicacao_id: publicacaoId, user_id: user.id }, { onConflict: 'publicacao_id,user_id' })

      if (error) throw error
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'mark-unread') {
      const { publicacaoId } = body
      const { error } = await supabase
        .from('publicacoes_dje_reads')
        .delete()
        .eq('publicacao_id', publicacaoId)
        .eq('user_id', user.id)

      if (error) throw error
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Ação inválida' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
