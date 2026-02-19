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

    // Check credentials
    const pjeUsername = Deno.env.get('PJE_CNJ_USERNAME')
    const pjePassword = Deno.env.get('PJE_CNJ_PASSWORD')

    if (action === 'check-credentials') {
      return new Response(JSON.stringify({ 
        configured: !!(pjeUsername && pjePassword) 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'search-local') {
      // Search from local database cache
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
      if (!pjeUsername || !pjePassword) {
        return new Response(JSON.stringify({ 
          error: 'Credenciais da API do CNJ não configuradas. Solicite ao administrador que configure PJE_CNJ_USERNAME e PJE_CNJ_PASSWORD.' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Build query params for CNJ API
      const params = new URLSearchParams()
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

      // Authenticate with CNJ SSO
      const authResponse = await fetch('https://sso.cloud.pje.jus.br/auth/realms/pje/protocol/openid-connect/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'password',
          client_id: 'pje-comunica-api',
          username: pjeUsername,
          password: pjePassword,
        }),
      })

      if (!authResponse.ok) {
        const errText = await authResponse.text()
        console.error('Auth error:', errText)
        return new Response(JSON.stringify({ 
          error: 'Falha na autenticação com o CNJ. Verifique as credenciais.',
          details: errText,
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const authData = await authResponse.json()
      const accessToken = authData.access_token

      // Query the communications API
      const apiUrl = `${PJE_API_BASE}/comunicacoes?${params.toString()}`
      const apiResponse = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      })

      if (!apiResponse.ok) {
        const errText = await apiResponse.text()
        console.error('API error:', errText)
        return new Response(JSON.stringify({ 
          error: 'Erro ao consultar API do CNJ.',
          details: errText,
        }), {
          status: apiResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const apiData = await apiResponse.json()
      const comunicacoes = apiData.items || apiData.comunicacoes || apiData || []

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
          nome_advogado: c.nomeAdvogado || '',
          numero_comunicacao: c.numeroComunicacao || '',
          siglaTribunal: c.siglaTribunal || filters?.tribunal || '',
          hash,
          raw_data: c,
        }
      })

      // Upsert to avoid duplicates
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
        total: apiData.totalItems || comunicacoes.length,
        cached: toInsert.length,
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
