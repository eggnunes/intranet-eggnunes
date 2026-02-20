import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const PJE_API_BASE = 'https://comunicaapi.pje.jus.br/api/v1'

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

    // A API do CNJ é pública — credenciais não são necessárias para consulta
    if (action === 'check-credentials') {
      return new Response(JSON.stringify({ configured: true }), {
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
      // Build query params for CNJ API (pública — sem autenticação necessária)
      const params = new URLSearchParams()

      // Filtros por advogado
      if (filters?.numeroOAB) {
        params.append('numeroOAB', filters.numeroOAB)
      }
      if (filters?.ufOAB) {
        params.append('ufOAB', filters.ufOAB)
      }
      if (filters?.nomeAdvogado) {
        params.append('nomeAdvogado', filters.nomeAdvogado)
      }

      // Filtros gerais
      if (filters?.numeroProcesso) {
        params.append('numeroProcesso', filters.numeroProcesso)
      }
      if (filters?.dataInicio) {
        params.append('dataDisponibilizacaoInicio', filters.dataInicio)
      }
      if (filters?.dataFim) {
        params.append('dataDisponibilizacaoFim', filters.dataFim)
      }
      if (filters?.tribunal) {
        params.append('siglaTribunal', filters.tribunal)
      }
      if (filters?.tipoComunicacao) {
        params.append('tipoComunicacao', filters.tipoComunicacao)
      }

      // Paginação
      const pagina = filters?.pagina || 1
      const tamanhoPagina = filters?.tamanhoPagina || 20
      params.append('pagina', String(pagina))
      params.append('tamanhoPagina', String(tamanhoPagina))

      console.log(`Consultando API pública do CNJ: ${PJE_API_BASE}/comunicacoes?${params.toString()}`)

      // Chamada sem autenticação — endpoint público conforme CNJ
      const apiUrl = `${PJE_API_BASE}/comunicacoes?${params.toString()}`
      const apiResponse = await fetch(apiUrl, {
        headers: {
          'Accept': 'application/json',
        },
      })

      if (!apiResponse.ok) {
        const errText = await apiResponse.text()
        console.error('API error:', errText)
        return new Response(JSON.stringify({
          error: `Erro ao consultar API do CNJ (HTTP ${apiResponse.status}).`,
          details: errText,
        }), {
          status: apiResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const apiData = await apiResponse.json()
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
