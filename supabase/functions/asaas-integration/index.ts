import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ASAAS_API_URL = 'https://api.asaas.com/v3';

interface AsaasCustomer {
  id?: string;
  name: string;
  cpfCnpj: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  postalCode?: string;
  externalReference?: string;
}

interface AsaasPayment {
  id?: string;
  customer: string;
  billingType: 'BOLETO' | 'CREDIT_CARD' | 'PIX' | 'UNDEFINED';
  value?: number;
  dueDate: string;
  description?: string;
  externalReference?: string;
  installmentCount?: number;
  installmentValue?: number;
  discount?: {
    value: number;
    dueDateLimitDays: number;
    type?: 'FIXED' | 'PERCENTAGE';
  };
  fine?: {
    value: number;
    type?: 'FIXED' | 'PERCENTAGE';
  };
  interest?: {
    value: number;
    type?: 'PERCENTAGE';
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
    
    if (!ASAAS_API_KEY) {
      console.error('ASAAS_API_KEY não configurada');
      return new Response(
        JSON.stringify({ error: 'Configuração do Asaas não encontrada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, data } = await req.json();
    console.log(`Asaas Integration - Action: ${action}`, data);

    const headers = {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY,
    };

    let result;

    switch (action) {
      // ===================== CLIENTES =====================
      case 'list_customers': {
        const params = new URLSearchParams();
        if (data?.name) params.append('name', data.name);
        if (data?.cpfCnpj) params.append('cpfCnpj', data.cpfCnpj);
        if (data?.email) params.append('email', data.email);
        if (data?.offset) params.append('offset', data.offset.toString());
        if (data?.limit) params.append('limit', (data.limit || 50).toString());

        const url = `${ASAAS_API_URL}/customers?${params.toString()}`;
        console.log('Fetching customers:', url);
        
        const response = await fetch(url, { method: 'GET', headers });
        result = await response.json();
        console.log('Customers result:', result);
        break;
      }

      case 'get_customer': {
        const response = await fetch(`${ASAAS_API_URL}/customers/${data.customerId}`, {
          method: 'GET',
          headers,
        });
        result = await response.json();
        break;
      }

      case 'create_customer': {
        const customerData: AsaasCustomer = {
          name: data.name,
          cpfCnpj: data.cpfCnpj?.replace(/\D/g, ''),
          email: data.email,
          phone: data.phone?.replace(/\D/g, ''),
          mobilePhone: data.mobilePhone?.replace(/\D/g, ''),
          address: data.address,
          addressNumber: data.addressNumber,
          complement: data.complement,
          province: data.province,
          postalCode: data.postalCode?.replace(/\D/g, ''),
          externalReference: data.externalReference,
        };

        const response = await fetch(`${ASAAS_API_URL}/customers`, {
          method: 'POST',
          headers,
          body: JSON.stringify(customerData),
        });
        result = await response.json();
        console.log('Customer created:', result);
        break;
      }

      case 'update_customer': {
        const { customerId, ...customerData } = data;
        const response = await fetch(`${ASAAS_API_URL}/customers/${customerId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(customerData),
        });
        result = await response.json();
        break;
      }

      // ===================== COBRANÇAS =====================
      case 'list_payments': {
        const params = new URLSearchParams();
        if (data?.customer) params.append('customer', data.customer);
        if (data?.billingType) params.append('billingType', data.billingType);
        if (data?.status) params.append('status', data.status);
        if (data?.offset) params.append('offset', data.offset.toString());
        if (data?.limit) params.append('limit', (data.limit || 50).toString());
        if (data?.dateCreatedGe) params.append('dateCreated[ge]', data.dateCreatedGe);
        if (data?.dateCreatedLe) params.append('dateCreated[le]', data.dateCreatedLe);
        if (data?.dueDateGe) params.append('dueDate[ge]', data.dueDateGe);
        if (data?.dueDateLe) params.append('dueDate[le]', data.dueDateLe);

        const url = `${ASAAS_API_URL}/payments?${params.toString()}`;
        console.log('Fetching payments:', url);
        
        const response = await fetch(url, { method: 'GET', headers });
        const paymentsResult = await response.json();
        console.log('Payments result:', paymentsResult);
        
        // Buscar nomes dos clientes para cada pagamento
        if (paymentsResult.data && paymentsResult.data.length > 0) {
          // Criar um cache de IDs de clientes únicos
          const customerIds = [...new Set(paymentsResult.data.map((p: any) => p.customer))] as string[];
          const customerNames: Record<string, string> = {};
          
          // Buscar informações de cada cliente
          await Promise.all(
            customerIds.map(async (customerId) => {
              try {
                const customerRes = await fetch(`${ASAAS_API_URL}/customers/${customerId}`, {
                  method: 'GET',
                  headers,
                });
                const customerData = await customerRes.json();
                if (customerData.name) {
                  customerNames[customerId] = customerData.name;
                }
              } catch (err) {
                console.error(`Erro ao buscar cliente ${customerId}:`, err);
              }
            })
          );
          
          // Adicionar nome do cliente em cada pagamento
          paymentsResult.data = paymentsResult.data.map((payment: any) => ({
            ...payment,
            customerName: customerNames[payment.customer] || payment.customer,
          }));
        }
        
        result = paymentsResult;
        break;
      }

      case 'get_payment': {
        const response = await fetch(`${ASAAS_API_URL}/payments/${data.paymentId}`, {
          method: 'GET',
          headers,
        });
        result = await response.json();
        break;
      }

      case 'create_payment': {
        const paymentData: AsaasPayment = {
          customer: data.customer,
          billingType: data.billingType,
          dueDate: data.dueDate,
          description: data.description,
          externalReference: data.externalReference,
        };

        // Se for parcelado
        if (data.installmentCount && data.installmentCount > 1) {
          paymentData.installmentCount = data.installmentCount;
          paymentData.installmentValue = data.installmentValue;
        } else {
          paymentData.value = data.value;
        }

        // Configurações opcionais
        if (data.discount) {
          paymentData.discount = {
            value: data.discount.value,
            dueDateLimitDays: data.discount.dueDateLimitDays || 0,
            type: data.discount.type || 'FIXED',
          };
        }
        if (data.fine) {
          paymentData.fine = {
            value: data.fine.value,
            type: data.fine.type || 'PERCENTAGE',
          };
        }
        if (data.interest) {
          paymentData.interest = {
            value: data.interest.value,
            type: 'PERCENTAGE',
          };
        }

        console.log('Creating payment:', paymentData);
        
        const response = await fetch(`${ASAAS_API_URL}/payments`, {
          method: 'POST',
          headers,
          body: JSON.stringify(paymentData),
        });
        result = await response.json();
        console.log('Payment created:', result);
        break;
      }

      case 'delete_payment': {
        const response = await fetch(`${ASAAS_API_URL}/payments/${data.paymentId}`, {
          method: 'DELETE',
          headers,
        });
        if (response.status === 200) {
          result = { success: true, message: 'Cobrança excluída com sucesso' };
        } else {
          result = await response.json();
        }
        break;
      }

      case 'get_payment_boleto': {
        // Buscar linha digitável do boleto
        const response = await fetch(`${ASAAS_API_URL}/payments/${data.paymentId}/identificationField`, {
          method: 'GET',
          headers,
        });
        result = await response.json();
        break;
      }

      case 'get_payment_pix': {
        // Buscar QR Code PIX
        const response = await fetch(`${ASAAS_API_URL}/payments/${data.paymentId}/pixQrCode`, {
          method: 'GET',
          headers,
        });
        result = await response.json();
        break;
      }

      // ===================== PARCELAMENTO =====================
      case 'get_installment': {
        const response = await fetch(`${ASAAS_API_URL}/installments/${data.installmentId}`, {
          method: 'GET',
          headers,
        });
        result = await response.json();
        break;
      }

      case 'get_installment_payments': {
        const response = await fetch(`${ASAAS_API_URL}/installments/${data.installmentId}/payments`, {
          method: 'GET',
          headers,
        });
        result = await response.json();
        break;
      }

      case 'get_installment_book': {
        // Carnê de pagamento
        const response = await fetch(`${ASAAS_API_URL}/installments/${data.installmentId}/paymentBook`, {
          method: 'GET',
          headers,
        });
        result = await response.json();
        break;
      }

      // ===================== ESTATÍSTICAS =====================
      case 'get_statistics': {
        // Buscar estatísticas gerais
        const [pendingRes, receivedRes, overdueRes] = await Promise.all([
          fetch(`${ASAAS_API_URL}/payments?status=PENDING&limit=0`, { method: 'GET', headers }),
          fetch(`${ASAAS_API_URL}/payments?status=RECEIVED&limit=0`, { method: 'GET', headers }),
          fetch(`${ASAAS_API_URL}/payments?status=OVERDUE&limit=0`, { method: 'GET', headers }),
        ]);

        const [pending, received, overdue] = await Promise.all([
          pendingRes.json(),
          receivedRes.json(),
          overdueRes.json(),
        ]);

        result = {
          pending: { count: pending.totalCount || 0 },
          received: { count: received.totalCount || 0 },
          overdue: { count: overdue.totalCount || 0 },
        };
        break;
      }

      // ===================== SALDO =====================
      case 'get_balance': {
        const response = await fetch(`${ASAAS_API_URL}/finance/balance`, {
          method: 'GET',
          headers,
        });
        result = await response.json();
        break;
      }

      // ===================== WEBHOOKS =====================
      case 'list_webhooks': {
        const response = await fetch(`${ASAAS_API_URL}/webhooks`, {
          method: 'GET',
          headers,
        });
        result = await response.json();
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Ação não reconhecida: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Erro na integração Asaas:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
