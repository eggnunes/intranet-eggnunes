import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { Calendar as CalendarIcon, Clock, CheckCircle, XCircle, Plus, User, Info, Users, FileText, Trash2, Pencil, LayoutDashboard, ClipboardList, DollarSign, Wallet, BarChart3 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { VacationDashboard } from '@/components/VacationDashboard';
import { format, differenceInBusinessDays, differenceInCalendarDays, parseISO, addYears, isBefore, isAfter, eachDayOfInterval, isWithinInterval, startOfMonth, endOfMonth, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
interface VacationRequest {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  business_days: number;
  status: 'pending' | 'approved' | 'rejected';
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
  created_at: string;
  acquisition_period_start: string | null;
  acquisition_period_end: string | null;
  sold_days: number | null;
  profiles: {
    full_name: string;
    avatar_url: string | null;
    position: string | null;
  };
  approver?: {
    full_name: string;
  };
}

interface VacationBalance {
  id: string;
  user_id: string;
  year: number;
  total_days: number;
  used_days: number;
  available_days: number;
}

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  position: string | null;
  join_date: string | null;
}

interface UserProfile {
  position: string | null;
  join_date: string | null;
}

// Check if position is CLT (administrativo or comercial = 30 consecutive days)
const isCLT = (position: string | null): boolean => {
  return position === 'administrativo' || position === 'comercial';
};

// Get total vacation days based on position
const getTotalVacationDays = (position: string | null): number => {
  return isCLT(position) ? 30 : 20;
};

// Get vacation type label
const getVacationTypeLabel = (position: string | null): string => {
  return isCLT(position) ? 'dias corridos' : 'dias úteis';
};

// Calculate vacation period based on join_date
const calculateVacationPeriod = (joinDate: string | null): { startDate: Date; endDate: Date; periodLabel: string } | null => {
  if (!joinDate) return null;
  
  const join = parseISO(joinDate);
  const today = new Date();
  
  // Find the current vacation period based on join_date anniversary
  let periodStart = join;
  let periodEnd = addYears(join, 1);
  
  // Move forward until we find the period that contains today or the most recent completed period
  while (isBefore(periodEnd, today)) {
    periodStart = periodEnd;
    periodEnd = addYears(periodStart, 1);
  }
  
  // If today is before the first anniversary, use that first year
  if (isAfter(join, today)) {
    periodStart = join;
    periodEnd = addYears(join, 1);
  }
  
  const periodLabel = `${format(periodStart, "dd/MM/yyyy")} - ${format(periodEnd, "dd/MM/yyyy")}`;
  
  return { startDate: periodStart, endDate: periodEnd, periodLabel };
};

// Interface for acquisition period
interface AcquisitionPeriod {
  value: string;
  label: string;
  startDate: Date;
  endDate: Date;
  totalDays?: number; // Optional override for total vacation days in this period
  note?: string; // Optional note for special periods
}

// Special acquisition periods configuration for specific users
// Jordânia: Had 15 days as intern (15/01/2024 to 30/09/2024), then 20 days as lawyer from 01/10/2024
const SPECIAL_USER_PERIODS: Record<string, { 
  periods: Array<{ 
    start: string; 
    end: string; 
    totalDays: number; 
    note: string;
    fullyUsed?: boolean; // Mark if all days were already used
  }>;
  regularPeriodsStartFrom: string; // Date from which regular periods start
}> = {
  '1b5787c3-c10d-4e0b-8699-83d0a2215dea': { // Jordânia Luíze Guedes Almeida
    periods: [
      {
        start: '2024-01-15',
        end: '2024-09-30',
        totalDays: 15,
        note: 'Período como estagiária - 15 dias úteis (já gozados integralmente)',
        fullyUsed: true
      }
    ],
    regularPeriodsStartFrom: '2024-10-01' // Regular 20-day periods start from here
  }
};

// Generate all acquisition periods for a user based on join_date
const generateAcquisitionPeriods = (joinDate: string | null, userId?: string): AcquisitionPeriod[] => {
  if (!joinDate) return [];
  
  const specialConfig = userId ? SPECIAL_USER_PERIODS[userId] : null;
  const periods: AcquisitionPeriod[] = [];
  const today = new Date();
  
  // If user has special periods, add them first
  if (specialConfig) {
    for (const special of specialConfig.periods) {
      periods.push({
        value: `${special.start}|${special.end}`,
        label: `${format(parseISO(special.start), "dd/MM/yyyy")} a ${format(parseISO(special.end), "dd/MM/yyyy")}`,
        startDate: parseISO(special.start),
        endDate: parseISO(special.end),
        totalDays: special.totalDays,
        note: special.note
      });
    }
    
    // Generate regular periods starting from the configured date
    let periodStart = parseISO(specialConfig.regularPeriodsStartFrom);
    let periodEnd = addYears(periodStart, 1);
    const maxPeriods = 10;
    let count = 0;
    
    while (count < maxPeriods) {
      if (isBefore(periodStart, addYears(today, 1))) {
        const startStr = format(periodStart, 'yyyy-MM-dd');
        const endStr = format(periodEnd, 'yyyy-MM-dd');
        
        periods.push({
          value: `${startStr}|${endStr}`,
          label: `${format(periodStart, "dd/MM/yyyy")} a ${format(periodEnd, "dd/MM/yyyy")}`,
          startDate: periodStart,
          endDate: periodEnd,
        });
      }
      
      periodStart = periodEnd;
      periodEnd = addYears(periodStart, 1);
      count++;
      
      if (isAfter(periodStart, addYears(today, 1))) break;
    }
  } else {
    // Standard logic for users without special periods
    const join = parseISO(joinDate);
    let periodStart = join;
    let periodEnd = addYears(join, 1);
    const maxPeriods = 10;
    let count = 0;
    
    while (count < maxPeriods) {
      if (isBefore(periodStart, addYears(today, 1))) {
        const startStr = format(periodStart, 'yyyy-MM-dd');
        const endStr = format(periodEnd, 'yyyy-MM-dd');
        
        periods.push({
          value: `${startStr}|${endStr}`,
          label: `${format(periodStart, "dd/MM/yyyy")} a ${format(periodEnd, "dd/MM/yyyy")}`,
          startDate: periodStart,
          endDate: periodEnd,
        });
      }
      
      periodStart = periodEnd;
      periodEnd = addYears(periodStart, 1);
      count++;
      
      if (isAfter(periodStart, addYears(today, 1))) break;
    }
  }
  
  return periods;
};

// Get total days for a specific acquisition period (handles special periods)
const getTotalDaysForPeriod = (
  period: AcquisitionPeriod | undefined, 
  position: string | null,
  userId?: string
): number => {
  // If period has explicit totalDays (special period), use it
  if (period?.totalDays !== undefined) {
    return period.totalDays;
  }
  // Otherwise use standard logic based on position
  return getTotalVacationDays(position);
};

// Check if a period is fully used (for special cases like Jordânia's internship period)
const isPeriodFullyUsed = (periodStart: string, periodEnd: string, userId?: string): boolean => {
  if (!userId) return false;
  const specialConfig = SPECIAL_USER_PERIODS[userId];
  if (!specialConfig) return false;
  
  const specialPeriod = specialConfig.periods.find(
    p => p.start === periodStart && p.end === periodEnd
  );
  return specialPeriod?.fullyUsed === true;
};

// Calculate used days in a specific acquisition period
const calculateUsedDaysInPeriod = (
  requests: Array<{
    id: string;
    status: string;
    acquisition_period_start: string | null;
    acquisition_period_end: string | null;
    business_days: number;
  }>,
  periodStart: string,
  periodEnd: string,
  excludeRequestId?: string
): number => {
  return requests
    .filter(req => 
      req.status === 'approved' &&
      req.acquisition_period_start === periodStart &&
      req.acquisition_period_end === periodEnd &&
      req.id !== excludeRequestId
    )
    .reduce((sum, req) => sum + (req.business_days || 0), 0);
};

export default function Ferias() {
  const { user } = useAuth();
  const { isAdmin, profile: userProfile } = useUserRole();
  const { canEdit, isSocioOrRafael } = useAdminPermissions();
  const [requests, setRequests] = useState<VacationRequest[]>([]);
  const [balance, setBalance] = useState<VacationBalance | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);
  const [isAdminCreateOpen, setIsAdminCreateOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [notes, setNotes] = useState('');
  const [adminSelectedUser, setAdminSelectedUser] = useState<string>('');
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [selectedUserProfile, setSelectedUserProfile] = useState<UserProfile | null>(null);
  const [filteredUserProfile, setFilteredUserProfile] = useState<UserProfile | null>(null);
  const [reportStartDate, setReportStartDate] = useState<Date>(startOfMonth(new Date()));
  const [reportEndDate, setReportEndDate] = useState<Date>(endOfMonth(addMonths(new Date(), 2)));
  const [allApprovedRequests, setAllApprovedRequests] = useState<VacationRequest[]>([]);
  const [allVacationRequests, setAllVacationRequests] = useState<VacationRequest[]>([]);
  const [activeTab, setActiveTab] = useState<string>('requests');
  const [mainTab, setMainTab] = useState<string>('solicitations');
  const [editingRequest, setEditingRequest] = useState<VacationRequest | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editStartDate, setEditStartDate] = useState<Date>();
  const [editEndDate, setEditEndDate] = useState<Date>();
  const [editNotes, setEditNotes] = useState('');
  const [editAcquisitionStart, setEditAcquisitionStart] = useState<Date>();
  const [editAcquisitionEnd, setEditAcquisitionEnd] = useState<Date>();
  const [editSoldDays, setEditSoldDays] = useState<number>(0);
  // New request fields
  const [selectedAcquisitionPeriod, setSelectedAcquisitionPeriod] = useState<string>('');
  const [adminSelectedAcquisitionPeriod, setAdminSelectedAcquisitionPeriod] = useState<string>('');
  const [editSelectedAcquisitionPeriod, setEditSelectedAcquisitionPeriod] = useState<string>('');
  const [soldDays, setSoldDays] = useState<number>(0);
  const [balanceSelectedUser, setBalanceSelectedUser] = useState<string>('');
  const [balanceUserProfile, setBalanceUserProfile] = useState<UserProfile | null>(null);
  const [balanceUserRequests, setBalanceUserRequests] = useState<VacationRequest[]>([]);
  const [balanceUserAllRequests, setBalanceUserAllRequests] = useState<VacationRequest[]>([]);
  const [balanceUserData, setBalanceUserData] = useState<{ total: number; used: number; available: number } | null>(null);
  const [balanceSelectedPeriod, setBalanceSelectedPeriod] = useState<string>('all');
  const [balanceUserAcquisitionPeriods, setBalanceUserAcquisitionPeriods] = useState<AcquisitionPeriod[]>([]);
  const [currentUserRequests, setCurrentUserRequests] = useState<VacationRequest[]>([]);
  const [selectedUserRequests, setSelectedUserRequests] = useState<VacationRequest[]>([]);

  // Chart data for vacation distribution by acquisition period
  const vacationChartData = useMemo(() => {
    if (!balanceUserAcquisitionPeriods.length) return [];
    
    return balanceUserAcquisitionPeriods.map((period) => {
      const periodTotalDays = getTotalDaysForPeriod(period, balanceUserProfile?.position || null, balanceSelectedUser);
      const [periodStart, periodEnd] = period.value.split('|');
      
      // Check if this is a special period marked as fully used
      const specialConfig = SPECIAL_USER_PERIODS[balanceSelectedUser];
      const specialPeriod = specialConfig?.periods.find(
        p => p.start === periodStart && p.end === periodEnd
      );
      
      let usedInPeriod: number;
      if (specialPeriod?.fullyUsed) {
        // For fully used special periods, use the total days as used
        usedInPeriod = specialPeriod.totalDays;
      } else {
        // Calculate from actual requests
        usedInPeriod = balanceUserAllRequests
          .filter(req => 
            req.acquisition_period_start === periodStart &&
            req.acquisition_period_end === periodEnd
          )
          .reduce((sum, req) => sum + (req.business_days || 0), 0);
      }
      
      const availableInPeriod = Math.max(0, periodTotalDays - usedInPeriod);
      
      return {
        name: `${format(period.startDate, 'yyyy')}/${format(period.endDate, 'yyyy')}`,
        fullLabel: period.label + (period.note ? ` (${period.note})` : ''),
        usado: usedInPeriod,
        disponivel: availableInPeriod,
        total: periodTotalDays,
      };
    }).filter(item => item.usado > 0 || item.disponivel > 0 || balanceUserAcquisitionPeriods.length <= 5);
  }, [balanceUserAllRequests, balanceUserAcquisitionPeriods, balanceUserProfile, balanceSelectedUser]);
  
  // Generate acquisition periods for current user
  const currentUserAcquisitionPeriods = generateAcquisitionPeriods(currentUserProfile?.join_date || null, user?.id);
  const selectedUserAcquisitionPeriods = generateAcquisitionPeriods(selectedUserProfile?.join_date || null, adminSelectedUser || undefined);
  
  // Check if user can manage vacations
  const canManageVacations = isAdmin && (isSocioOrRafael || canEdit('vacation'));

  useEffect(() => {
    if (user) {
      fetchData();
      fetchCurrentUserProfile();
      fetchCurrentUserRequests();
      if (canManageVacations) {
        fetchProfiles();
        fetchAllApprovedRequests();
        fetchAllVacationRequests();
      }
    }
  }, [user, canManageVacations, selectedUser]);

  // Fetch current user's vacation requests for balance calculation
  const fetchCurrentUserRequests = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('vacation_requests')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'approved');
    if (data) {
      setCurrentUserRequests(data as any);
    }
  };

  // Update selected user profile and fetch their requests when admin selects a user for creating vacation
  useEffect(() => {
    if (adminSelectedUser) {
      const profile = profiles.find(p => p.id === adminSelectedUser);
      if (profile) {
        setSelectedUserProfile({
          position: profile.position,
          join_date: profile.join_date
        });
      }
      // Reset acquisition period selection when user changes
      setAdminSelectedAcquisitionPeriod('');
      // Fetch selected user's vacation requests
      fetchSelectedUserRequests(adminSelectedUser);
    } else {
      setSelectedUserProfile(null);
      setAdminSelectedAcquisitionPeriod('');
      setSelectedUserRequests([]);
    }
  }, [adminSelectedUser, profiles]);

  // Fetch selected user's vacation requests for balance calculation
  const fetchSelectedUserRequests = async (userId: string) => {
    const { data } = await supabase
      .from('vacation_requests')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'approved');
    if (data) {
      setSelectedUserRequests(data as any);
    }
  };

  // Update filtered user profile when admin filters by a specific user
  useEffect(() => {
    if (selectedUser && selectedUser !== 'all') {
      const profile = profiles.find(p => p.id === selectedUser);
      if (profile) {
        setFilteredUserProfile({
          position: profile.position,
          join_date: profile.join_date
        });
      }
    } else {
      setFilteredUserProfile(null);
    }
  }, [selectedUser, profiles]);

  // Fetch balance user data when admin selects a user in the Balance tab
  useEffect(() => {
    if (balanceSelectedUser && profiles.length > 0) {
      const profile = profiles.find(p => p.id === balanceSelectedUser);
      if (profile) {
        setBalanceUserProfile({
          position: profile.position,
          join_date: profile.join_date
        });
        const periods = generateAcquisitionPeriods(profile.join_date, balanceSelectedUser);
        setBalanceUserAcquisitionPeriods(periods);
        setBalanceSelectedPeriod('all'); // Reset to all when user changes
        fetchBalanceUserData(balanceSelectedUser, profile.position, 'all');
      }
    } else {
      setBalanceUserProfile(null);
      setBalanceUserRequests([]);
      setBalanceUserAllRequests([]);
      setBalanceUserData(null);
      setBalanceUserAcquisitionPeriods([]);
      setBalanceSelectedPeriod('all');
    }
  }, [balanceSelectedUser, profiles]);

  // Refetch when period filter changes
  useEffect(() => {
    if (balanceSelectedUser && balanceUserProfile) {
      fetchBalanceUserData(balanceSelectedUser, balanceUserProfile.position, balanceSelectedPeriod);
    }
  }, [balanceSelectedPeriod]);

  const fetchBalanceUserData = async (userId: string, position: string | null, periodFilter: string = 'all') => {
    // Always fetch all requests first for the chart
    const { data: allRequestsData } = await supabase
      .from('vacation_requests')
      .select(`
        *,
        profiles:user_id (full_name, avatar_url, position),
        approver:approved_by (full_name)
      `)
      .eq('user_id', userId)
      .eq('status', 'approved')
      .order('start_date', { ascending: false });

    if (allRequestsData) {
      setBalanceUserAllRequests(allRequestsData as any);
    }

    // Fetch filtered requests based on period selection
    let filteredRequests = allRequestsData || [];
    
    if (periodFilter && periodFilter !== 'all') {
      const [periodStart, periodEnd] = periodFilter.split('|');
      filteredRequests = (allRequestsData || []).filter(req => 
        req.acquisition_period_start === periodStart &&
        req.acquisition_period_end === periodEnd
      );
    }

    setBalanceUserRequests(filteredRequests as any);
    
    // Calculate used days from approved requests in selected period
    const usedDays = filteredRequests.reduce((sum, req) => sum + (req.business_days || 0), 0);
    const totalDays = getTotalVacationDays(position);
    const availableDays = Math.max(0, totalDays - usedDays);
    
    setBalanceUserData({
      total: totalDays,
      used: usedDays,
      available: availableDays
    });
  };

  const fetchCurrentUserProfile = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('profiles')
      .select('position, join_date')
      .eq('id', user.id)
      .single();
    
    if (data) {
      setCurrentUserProfile(data);
    }
  };

  const fetchProfiles = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, position, join_date')
      .eq('approval_status', 'approved')
      .order('full_name');
    
    if (data) {
      setProfiles(data);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    
    // Buscar solicitações
    let requestsQuery = supabase
      .from('vacation_requests')
      .select(`
        *,
        profiles:user_id (full_name, avatar_url, position),
        approver:approved_by (full_name)
      `)
      .order('created_at', { ascending: false });

    if (!isAdmin) {
      requestsQuery = requestsQuery.eq('user_id', user!.id);
    } else if (selectedUser !== 'all') {
      requestsQuery = requestsQuery.eq('user_id', selectedUser);
    }

    const { data: requestsData } = await requestsQuery;
    if (requestsData) {
      setRequests(requestsData as any);
    }

    // Buscar saldo do ano atual
    const currentYear = new Date().getFullYear();
    const userId = isAdmin && selectedUser !== 'all' ? selectedUser : user!.id;
    
    const { data: balanceData } = await supabase
      .from('vacation_balance')
      .select('*')
      .eq('user_id', userId)
      .eq('year', currentYear)
      .single();

    setBalance(balanceData);
    setLoading(false);
  };

  const fetchAllApprovedRequests = async () => {
    const { data } = await supabase
      .from('vacation_requests')
      .select(`
        *,
        profiles:user_id (full_name, avatar_url, position),
        approver:approved_by (full_name)
      `)
      .eq('status', 'approved')
      .order('start_date', { ascending: true });
    
    if (data) {
      setAllApprovedRequests(data as any);
    }
  };

  const fetchAllVacationRequests = async () => {
    const { data } = await supabase
      .from('vacation_requests')
      .select(`
        *,
        profiles:user_id (full_name, avatar_url, position),
        approver:approved_by (full_name)
      `)
      .order('start_date', { ascending: false });
    
    if (data) {
      setAllVacationRequests(data as any);
    }
  };

  // Get vacations that overlap with a specific period
  const getVacationsInPeriod = () => {
    return allApprovedRequests.filter(request => {
      const vacationStart = parseISO(request.start_date);
      const vacationEnd = parseISO(request.end_date);
      
      // Check if vacation overlaps with report period
      return !(vacationEnd < reportStartDate || vacationStart > reportEndDate);
    });
  };

  // Get people on vacation for a specific date
  const getPeopleOnVacation = (date: Date) => {
    return allApprovedRequests.filter(request => {
      const vacationStart = parseISO(request.start_date);
      const vacationEnd = parseISO(request.end_date);
      return isWithinInterval(date, { start: vacationStart, end: vacationEnd });
    });
  };

  // Generate days array for the report period
  const getReportDays = () => {
    if (!reportStartDate || !reportEndDate) return [];
    return eachDayOfInterval({ start: reportStartDate, end: reportEndDate });
  };

  // Calculate days based on position (CLT = consecutive, others = business days)
  const calculateDays = (start: Date, end: Date, position: string | null): number => {
    if (isCLT(position)) {
      // CLT: consecutive calendar days (including start and end)
      return differenceInCalendarDays(end, start) + 1;
    } else {
      // Non-CLT: business days only
      return differenceInBusinessDays(end, start) + 1;
    }
  };

  // Get profile for calculation context
  const getActiveProfile = (): UserProfile | null => {
    if (isAdminCreateOpen && selectedUserProfile) {
      return selectedUserProfile;
    }
    return currentUserProfile;
  };

  // Calculate vacation balance based on join_date and used days
  const calculateVacationBalance = (profile: UserProfile | null, usedDays: number): { total: number; used: number; available: number } => {
    const totalDays = getTotalVacationDays(profile?.position || null);
    const available = Math.max(0, totalDays - usedDays);
    return { total: totalDays, used: usedDays, available };
  };

  const handleCreateRequest = async () => {
    if (!startDate || !endDate) {
      toast({
        title: 'Erro',
        description: 'Selecione as datas de início e fim',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedAcquisitionPeriod) {
      toast({
        title: 'Erro',
        description: 'Selecione o período aquisitivo',
        variant: 'destructive',
      });
      return;
    }

    if (startDate > endDate) {
      toast({
        title: 'Erro',
        description: 'Data de início não pode ser posterior à data de fim',
        variant: 'destructive',
      });
      return;
    }

    const days = calculateDays(startDate, endDate, currentUserProfile?.position || null);
    const [acqStart, acqEnd] = selectedAcquisitionPeriod.split('|');
    
    // Check if this period is marked as fully used (special case like Jordânia's internship)
    if (isPeriodFullyUsed(acqStart, acqEnd, user?.id)) {
      toast({
        title: 'Período totalmente utilizado',
        description: 'Este período aquisitivo já foi totalmente gozado. Selecione outro período aquisitivo.',
        variant: 'destructive',
      });
      return;
    }
    
    // Get total days for this specific period (may be different for special periods)
    const currentPeriod = currentUserAcquisitionPeriods.find(p => p.value === selectedAcquisitionPeriod);
    const totalDays = getTotalDaysForPeriod(currentPeriod, currentUserProfile?.position || null, user?.id);
    
    // Calculate used days in the selected acquisition period
    const usedDaysInPeriod = calculateUsedDaysInPeriod(currentUserRequests, acqStart, acqEnd);
    const availableDaysInPeriod = totalDays - usedDaysInPeriod;
    const vacationTypeLabel = getVacationTypeLabel(currentUserProfile?.position || null);

    if (days > availableDaysInPeriod) {
      toast({
        title: 'Saldo insuficiente no período aquisitivo',
        description: `Você tem apenas ${availableDaysInPeriod} ${vacationTypeLabel} disponíveis neste período aquisitivo. Já foram utilizados ${usedDaysInPeriod} ${vacationTypeLabel}.`,
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase
      .from('vacation_requests')
      .insert({
        user_id: user!.id,
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        business_days: days,
        notes,
        acquisition_period_start: acqStart,
        acquisition_period_end: acqEnd,
        sold_days: soldDays || 0,
      });

    if (error) {
      toast({
        title: 'Erro ao criar solicitação',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Solicitação criada',
      description: 'Sua solicitação de férias foi enviada para aprovação',
    });

    setIsNewRequestOpen(false);
    setStartDate(undefined);
    setEndDate(undefined);
    setNotes('');
    setSelectedAcquisitionPeriod('');
    setSoldDays(0);
    fetchData();
    fetchCurrentUserRequests();
  };

  const handleAdminCreate = async () => {
    if (!adminSelectedUser || !startDate || !endDate) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    if (!adminSelectedAcquisitionPeriod) {
      toast({
        title: 'Erro',
        description: 'Selecione o período aquisitivo',
        variant: 'destructive',
      });
      return;
    }

    const days = calculateDays(startDate, endDate, selectedUserProfile?.position || null);
    const [acqStart, acqEnd] = adminSelectedAcquisitionPeriod.split('|');
    
    // Check if this period is marked as fully used (special case like Jordânia's internship)
    if (isPeriodFullyUsed(acqStart, acqEnd, adminSelectedUser)) {
      toast({
        title: 'Período totalmente utilizado',
        description: 'Este período aquisitivo já foi totalmente gozado. Selecione outro período aquisitivo.',
        variant: 'destructive',
      });
      return;
    }
    
    // Get total days for this specific period (may be different for special periods)
    const currentPeriod = selectedUserAcquisitionPeriods.find(p => p.value === adminSelectedAcquisitionPeriod);
    const totalDays = getTotalDaysForPeriod(currentPeriod, selectedUserProfile?.position || null, adminSelectedUser);
    
    // Calculate used days in the selected acquisition period for the selected user
    const usedDaysInPeriod = calculateUsedDaysInPeriod(selectedUserRequests, acqStart, acqEnd);
    const availableDaysInPeriod = totalDays - usedDaysInPeriod;
    const vacationTypeLabel = getVacationTypeLabel(selectedUserProfile?.position || null);

    if (days > availableDaysInPeriod) {
      toast({
        title: 'Saldo insuficiente no período aquisitivo',
        description: `Este colaborador tem apenas ${availableDaysInPeriod} ${vacationTypeLabel} disponíveis neste período aquisitivo. Já foram utilizados ${usedDaysInPeriod} ${vacationTypeLabel}.`,
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase
      .from('vacation_requests')
      .insert({
        user_id: adminSelectedUser,
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        business_days: days,
        status: 'approved',
        approved_by: user!.id,
        approved_at: new Date().toISOString(),
        notes,
        acquisition_period_start: acqStart,
        acquisition_period_end: acqEnd,
        sold_days: soldDays || 0,
      });

    if (error) {
      toast({
        title: 'Erro ao registrar férias',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Férias registradas',
      description: 'Período de férias cadastrado com sucesso',
    });

    setIsAdminCreateOpen(false);
    setAdminSelectedUser('');
    setStartDate(undefined);
    setEndDate(undefined);
    setNotes('');
    setAdminSelectedAcquisitionPeriod('');
    setSoldDays(0);
    fetchData();
    fetchSelectedUserRequests(adminSelectedUser);
  };

  const handleApprove = async (requestId: string) => {
    const { error } = await supabase
      .from('vacation_requests')
      .update({
        status: 'approved',
        approved_by: user!.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (error) {
      toast({
        title: 'Erro ao aprovar',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Solicitação aprovada',
      description: 'As férias foram aprovadas com sucesso',
    });
    fetchData();
  };

  const handleReject = async (requestId: string, reason: string) => {
    const { error } = await supabase
      .from('vacation_requests')
      .update({
        status: 'rejected',
        rejection_reason: reason,
        approved_by: user!.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (error) {
      toast({
        title: 'Erro ao rejeitar',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Solicitação rejeitada',
      description: 'A solicitação foi rejeitada',
    });
    fetchData();
    fetchAllVacationRequests();
  };

  const handleDelete = async (requestId: string) => {
    if (!confirm('Tem certeza que deseja excluir este período de férias?')) return;

    const { error } = await supabase
      .from('vacation_requests')
      .delete()
      .eq('id', requestId);

    if (error) {
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Férias excluídas',
      description: 'O período de férias foi excluído com sucesso',
    });
    fetchData();
    fetchAllVacationRequests();
  };

  const openEditDialog = (request: VacationRequest) => {
    setEditingRequest(request);
    setEditStartDate(parseISO(request.start_date));
    setEditEndDate(parseISO(request.end_date));
    setEditNotes(request.notes || '');
    setEditAcquisitionStart(request.acquisition_period_start ? parseISO(request.acquisition_period_start) : undefined);
    setEditAcquisitionEnd(request.acquisition_period_end ? parseISO(request.acquisition_period_end) : undefined);
    setEditSoldDays(request.sold_days || 0);
    setIsEditDialogOpen(true);
  };

  const handleEditRequest = async () => {
    if (!editingRequest || !editStartDate || !editEndDate) return;

    const profile = profiles.find(p => p.id === editingRequest.user_id);
    const days = calculateDays(editStartDate, editEndDate, profile?.position || null);

    const { error } = await supabase
      .from('vacation_requests')
      .update({
        start_date: format(editStartDate, 'yyyy-MM-dd'),
        end_date: format(editEndDate, 'yyyy-MM-dd'),
        business_days: days,
        notes: editNotes,
        acquisition_period_start: editAcquisitionStart ? format(editAcquisitionStart, 'yyyy-MM-dd') : null,
        acquisition_period_end: editAcquisitionEnd ? format(editAcquisitionEnd, 'yyyy-MM-dd') : null,
        sold_days: editSoldDays || 0,
      })
      .eq('id', editingRequest.id);

    if (error) {
      toast({
        title: 'Erro ao editar',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Férias atualizadas',
      description: 'O período de férias foi atualizado com sucesso',
    });
    setIsEditDialogOpen(false);
    setEditingRequest(null);
    fetchData();
    fetchAllVacationRequests();
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: { variant: 'outline' as const, label: 'Pendente', icon: Clock },
      approved: { variant: 'default' as const, label: 'Aprovada', icon: CheckCircle },
      rejected: { variant: 'destructive' as const, label: 'Rejeitada', icon: XCircle },
    };
    const config = variants[status as keyof typeof variants];
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  // Determine which profile to use for balance display
  const displayProfile = (isAdmin && selectedUser !== 'all' && filteredUserProfile) 
    ? filteredUserProfile 
    : currentUserProfile;
  
  // Calculate display balance
  const totalDays = getTotalVacationDays(displayProfile?.position || null);
  const usedDays = balance?.used_days ?? 0;
  const availableDays = totalDays - usedDays;
  const vacationTypeLabel = getVacationTypeLabel(displayProfile?.position || null);
  const vacationPeriod = calculateVacationPeriod(displayProfile?.join_date || null);

  // For dialogs - calculate days preview
  const activeProfile = getActiveProfile();
  const previewDays = startDate && endDate ? calculateDays(startDate, endDate, activeProfile?.position || null) : 0;
  const previewTypeLabel = getVacationTypeLabel(activeProfile?.position || null);

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Gestão de Férias</h1>
            <p className="text-muted-foreground">Gerencie suas férias e acompanhe seu saldo</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isNewRequestOpen} onOpenChange={setIsNewRequestOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Solicitação
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Nova Solicitação de Férias</DialogTitle>
                  <DialogDescription>
                    Solicite suas férias informando o período desejado
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      {isCLT(currentUserProfile?.position || null) ? (
                        <>Você é colaborador CLT e tem direito a <strong>30 dias corridos</strong> de férias por ano.</>
                      ) : (
                        <>Você tem direito a <strong>20 dias úteis</strong> de férias por ano.</>
                      )}
                    </AlertDescription>
                  </Alert>
                  <div>
                    <Label>Data de Início</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !startDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {startDate ? format(startDate, 'PPP', { locale: ptBR }) : 'Selecione a data'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={setStartDate}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label>Data de Fim</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !endDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {endDate ? format(endDate, 'PPP', { locale: ptBR }) : 'Selecione a data'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={setEndDate}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  {startDate && endDate && (
                    <div className="p-3 bg-muted rounded-md">
                      <p className="text-sm font-medium">
                        {previewTypeLabel === 'dias corridos' ? 'Dias corridos' : 'Dias úteis'}: {previewDays}
                      </p>
                    </div>
                  )}
                  {/* Período Aquisitivo */}
                  <div className="space-y-2">
                    <Label className="font-medium">Período Aquisitivo *</Label>
                    {currentUserAcquisitionPeriods.length === 0 ? (
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                          Sua data de admissão não está cadastrada. Entre em contato com o RH.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <Select value={selectedAcquisitionPeriod} onValueChange={setSelectedAcquisitionPeriod}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o período aquisitivo" />
                        </SelectTrigger>
                        <SelectContent>
                          {currentUserAcquisitionPeriods.map((period) => (
                            <SelectItem key={period.value} value={period.value}>
                              <div className="flex flex-col">
                                <span>{period.label}</span>
                                {period.note && (
                                  <span className="text-xs text-muted-foreground">{period.totalDays} dias - {period.note}</span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  {/* Saldo no período aquisitivo selecionado */}
                  {selectedAcquisitionPeriod && (() => {
                    const [acqStart, acqEnd] = selectedAcquisitionPeriod.split('|');
                    const currentPeriod = currentUserAcquisitionPeriods.find(p => p.value === selectedAcquisitionPeriod);
                    const isFullyUsed = isPeriodFullyUsed(acqStart, acqEnd, user?.id);
                    const totalDays = getTotalDaysForPeriod(currentPeriod, currentUserProfile?.position || null, user?.id);
                    const usedInPeriod = calculateUsedDaysInPeriod(currentUserRequests, acqStart, acqEnd);
                    const availableInPeriod = isFullyUsed ? 0 : totalDays - usedInPeriod;
                    const typeLabel = getVacationTypeLabel(currentUserProfile?.position || null);
                    return (
                      <Alert className={availableInPeriod <= 0 ? 'border-destructive' : ''}>
                        <Wallet className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Saldo neste período:</strong> {availableInPeriod} {typeLabel} disponíveis
                          {usedInPeriod > 0 && ` (${usedInPeriod} já utilizados)`}
                          {currentPeriod?.note && (
                            <span className="block text-muted-foreground text-xs mt-1">
                              {currentPeriod.note}
                            </span>
                          )}
                          {availableInPeriod <= 0 && (
                            <span className="block text-destructive font-medium mt-1">
                              {isFullyUsed 
                                ? 'Este período já foi totalmente gozado. Selecione outro período aquisitivo.'
                                : 'Não há saldo disponível neste período. Selecione outro período aquisitivo.'}
                            </span>
                          )}
                        </AlertDescription>
                      </Alert>
                    );
                  })()}
                  {/* Dias Vendidos */}
                  <div>
                    <Label className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Dias Vendidos (opcional)
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      max="10"
                      value={soldDays || ''}
                      onChange={(e) => setSoldDays(parseInt(e.target.value) || 0)}
                      placeholder="0"
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Dias de férias vendidos ao escritório (abono pecuniário)</p>
                  </div>
                  <div>
                    <Label>Observações (opcional)</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Adicione observações sobre sua solicitação"
                      rows={3}
                    />
                  </div>
                  <Button onClick={handleCreateRequest} className="w-full">
                    Enviar Solicitação
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {canManageVacations && (
              <Dialog open={isAdminCreateOpen} onOpenChange={setIsAdminCreateOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    Cadastrar Férias Passadas
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Cadastrar Período de Férias</DialogTitle>
                    <DialogDescription>
                      Registre períodos de férias já tirados
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Colaborador</Label>
                      <Select value={adminSelectedUser} onValueChange={setAdminSelectedUser}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o colaborador" />
                        </SelectTrigger>
                        <SelectContent>
                          {profiles.map((profile) => (
                            <SelectItem key={profile.id} value={profile.id}>
                              {profile.full_name} {isCLT(profile.position) && '(CLT)'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedUserProfile && (
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                          {isCLT(selectedUserProfile.position) ? (
                            <>Este colaborador é <strong>CLT</strong> e tem direito a <strong>30 dias corridos</strong> de férias por ano.</>
                          ) : (
                            <>Este colaborador tem direito a <strong>20 dias úteis</strong> de férias por ano.</>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}
                    <div>
                      <Label>Data de Início</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !startDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {startDate ? format(startDate, 'PPP', { locale: ptBR }) : 'Selecione a data'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={startDate}
                            onSelect={setStartDate}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div>
                      <Label>Data de Fim</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !endDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {endDate ? format(endDate, 'PPP', { locale: ptBR }) : 'Selecione a data'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={endDate}
                            onSelect={setEndDate}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    {startDate && endDate && selectedUserProfile && (
                      <div className="p-3 bg-muted rounded-md">
                        <p className="text-sm font-medium">
                          {isCLT(selectedUserProfile.position) ? 'Dias corridos' : 'Dias úteis'}: {previewDays}
                        </p>
                      </div>
                    )}
                    {/* Período Aquisitivo */}
                    <div className="space-y-2">
                      <Label className="font-medium">Período Aquisitivo *</Label>
                      {!adminSelectedUser ? (
                        <p className="text-sm text-muted-foreground">Selecione um colaborador primeiro</p>
                      ) : selectedUserAcquisitionPeriods.length === 0 ? (
                        <Alert>
                          <Info className="h-4 w-4" />
                          <AlertDescription>
                            Este colaborador não possui data de admissão cadastrada. Atualize o perfil dele.
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <Select value={adminSelectedAcquisitionPeriod} onValueChange={setAdminSelectedAcquisitionPeriod}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o período aquisitivo" />
                          </SelectTrigger>
                          <SelectContent>
                            {selectedUserAcquisitionPeriods.map((period) => (
                              <SelectItem key={period.value} value={period.value}>
                                <div className="flex flex-col">
                                  <span>{period.label}</span>
                                  {period.note && (
                                    <span className="text-xs text-muted-foreground">{period.totalDays} dias - {period.note}</span>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    {/* Saldo no período aquisitivo selecionado */}
                    {adminSelectedAcquisitionPeriod && selectedUserProfile && (() => {
                      const [acqStart, acqEnd] = adminSelectedAcquisitionPeriod.split('|');
                      const currentPeriod = selectedUserAcquisitionPeriods.find(p => p.value === adminSelectedAcquisitionPeriod);
                      const isFullyUsed = isPeriodFullyUsed(acqStart, acqEnd, adminSelectedUser);
                      const totalDays = getTotalDaysForPeriod(currentPeriod, selectedUserProfile.position, adminSelectedUser);
                      const usedInPeriod = calculateUsedDaysInPeriod(selectedUserRequests, acqStart, acqEnd);
                      const availableInPeriod = isFullyUsed ? 0 : totalDays - usedInPeriod;
                      const typeLabel = getVacationTypeLabel(selectedUserProfile.position);
                      return (
                        <Alert className={availableInPeriod <= 0 ? 'border-destructive' : ''}>
                          <Wallet className="h-4 w-4" />
                          <AlertDescription>
                            <strong>Saldo neste período:</strong> {availableInPeriod} {typeLabel} disponíveis
                            {usedInPeriod > 0 && ` (${usedInPeriod} já utilizados)`}
                            {currentPeriod?.note && (
                              <span className="block text-muted-foreground text-xs mt-1">
                                {currentPeriod.note}
                              </span>
                            )}
                            {availableInPeriod <= 0 && (
                              <span className="block text-destructive font-medium mt-1">
                                {isFullyUsed 
                                  ? 'Este período já foi totalmente gozado. Selecione outro período aquisitivo.'
                                  : 'Não há saldo disponível neste período. Selecione outro período aquisitivo.'}
                              </span>
                            )}
                          </AlertDescription>
                        </Alert>
                      );
                    })()}
                    {/* Dias Vendidos */}
                    <div>
                      <Label className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Dias Vendidos (opcional)
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        max="10"
                        value={soldDays || ''}
                        onChange={(e) => setSoldDays(parseInt(e.target.value) || 0)}
                        placeholder="0"
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Dias de férias vendidos ao escritório (abono pecuniário)</p>
                    </div>
                    <div>
                      <Label>Observações (opcional)</Label>
                      <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Adicione observações"
                        rows={3}
                      />
                    </div>
                    <Button onClick={handleAdminCreate} className="w-full">
                      Cadastrar Férias
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Main Navigation Tabs */}
        <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
          <TabsList className={cn("grid w-full max-w-2xl", canManageVacations ? "grid-cols-3" : "grid-cols-1")}>
            <TabsTrigger value="solicitations" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Solicitações</span>
              <span className="sm:hidden">Solic.</span>
            </TabsTrigger>
            {canManageVacations && (
              <>
                <TabsTrigger value="balance" className="flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  <span className="hidden sm:inline">Saldo por Colaborador</span>
                  <span className="sm:hidden">Saldo</span>
                </TabsTrigger>
                <TabsTrigger value="dashboard" className="flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="hidden sm:inline">Dashboard</span>
                  <span className="sm:hidden">Dash</span>
                </TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="solicitations" className="space-y-6 mt-6">
            {canManageVacations && (
              <Card>
                <CardHeader>
                  <CardTitle>Filtrar por Colaborador</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger className="w-full md:w-[300px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os colaboradores</SelectItem>
                      {profiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.full_name} {isCLT(profile.position) && '(CLT)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Saldo de Férias
              {vacationPeriod && (
                <Badge variant="outline" className="font-normal">
                  Período: {vacationPeriod.periodLabel}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {isCLT(displayProfile?.position || null) ? (
                <>Colaborador CLT - 30 dias corridos por ano</>
              ) : (
                <>Colaborador - 20 dias úteis por ano</>
              )}
              {displayProfile?.join_date && (
                <> (ingresso em {format(parseISO(displayProfile.join_date), "dd/MM/yyyy")})</>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{totalDays} {vacationTypeLabel}</p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Utilizados</p>
                <p className="text-2xl font-bold text-orange-600">{usedDays} {vacationTypeLabel}</p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Disponíveis</p>
                <p className="text-2xl font-bold text-green-600">{availableDays} {vacationTypeLabel}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Histórico de Solicitações</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all">
              <TabsList>
                <TabsTrigger value="all">Todas</TabsTrigger>
                <TabsTrigger value="pending">Pendentes</TabsTrigger>
                <TabsTrigger value="approved">Aprovadas</TabsTrigger>
                <TabsTrigger value="rejected">Rejeitadas</TabsTrigger>
              </TabsList>
              
              {['all', 'pending', 'approved', 'rejected'].map((tab) => (
                <TabsContent key={tab} value={tab} className="space-y-4">
                  {requests
                    .filter((req) => tab === 'all' || req.status === tab)
                    .map((request) => (
                      <Card key={request.id}>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2 flex-1">
                              {canManageVacations && (
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">{request.profiles.full_name}</span>
                                  {isCLT(request.profiles.position) && (
                                    <Badge variant="secondary" className="text-xs">CLT</Badge>
                                  )}
                                </div>
                              )}
                              <div className="flex items-center gap-4 text-sm">
                                <span>
                                  {format(parseISO(request.start_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                </span>
                                <span>→</span>
                                <span>
                                  {format(parseISO(request.end_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                </span>
                                <span className="text-muted-foreground">
                                  ({request.business_days} {isCLT(request.profiles.position) ? 'dias corridos' : 'dias úteis'})
                                </span>
                              </div>
                              {request.notes && (
                                <p className="text-sm text-muted-foreground mt-2">{request.notes}</p>
                              )}
                              {request.rejection_reason && (
                                <p className="text-sm text-destructive mt-2">
                                  Motivo: {request.rejection_reason}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {getStatusBadge(request.status)}
                              {canManageVacations && request.status === 'pending' && (
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleApprove(request.id)}
                                  >
                                    Aprovar
                                  </Button>
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button size="sm" variant="outline">
                                        Rejeitar
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle>Rejeitar Solicitação</DialogTitle>
                                        <DialogDescription>
                                          Informe o motivo da rejeição
                                        </DialogDescription>
                                      </DialogHeader>
                                      <div className="space-y-4">
                                        <Textarea
                                          id={`reason-${request.id}`}
                                          placeholder="Motivo da rejeição"
                                          rows={3}
                                        />
                                        <Button
                                          onClick={() => {
                                            const reason = (document.getElementById(`reason-${request.id}`) as HTMLTextAreaElement)?.value;
                                            if (reason) {
                                              handleReject(request.id, reason);
                                            }
                                          }}
                                          className="w-full"
                                        >
                                          Confirmar Rejeição
                                        </Button>
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                </div>
                              )}
                              {canManageVacations && (
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => openEditDialog(request)}
                                    title="Editar"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => handleDelete(request.id)}
                                    title="Excluir"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  {requests.filter((req) => tab === 'all' || req.status === tab).length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhuma solicitação encontrada
                    </p>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        {/* Report Section - Only for admins - Grouped by Employee */}
        {canManageVacations && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Painel Geral de Férias - Agrupado por Colaborador
              </CardTitle>
              <CardDescription>
                Visualize todas as férias cadastradas, organizadas por colaborador
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                {allVacationRequests.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Nenhuma férias cadastrada
                  </p>
                ) : (
                  <div className="space-y-6">
                    {/* Group requests by user */}
                    {(() => {
                      const groupedByUser: Record<string, VacationRequest[]> = {};
                      allVacationRequests.forEach((request) => {
                        const userId = request.user_id;
                        if (!groupedByUser[userId]) {
                          groupedByUser[userId] = [];
                        }
                        groupedByUser[userId].push(request);
                      });

                      // Sort users alphabetically by name
                      const sortedUserIds = Object.keys(groupedByUser).sort((a, b) => {
                        const nameA = groupedByUser[a][0]?.profiles.full_name || '';
                        const nameB = groupedByUser[b][0]?.profiles.full_name || '';
                        return nameA.localeCompare(nameB);
                      });

                      return sortedUserIds.map((userId) => {
                        const userRequests = groupedByUser[userId];
                        const firstRequest = userRequests[0];
                        const userProfile = firstRequest?.profiles;
                        const today = new Date();
                        
                        // Sort requests by start_date descending (most recent first)
                        const sortedRequests = [...userRequests].sort((a, b) => 
                          parseISO(b.start_date).getTime() - parseISO(a.start_date).getTime()
                        );

                        // Calculate totals
                        const approvedRequests = sortedRequests.filter(r => r.status === 'approved');
                        const totalApprovedDays = approvedRequests.reduce((sum, r) => sum + (r.business_days || 0), 0);
                        const pastVacations = approvedRequests.filter(r => isBefore(parseISO(r.end_date), today));
                        const futureVacations = approvedRequests.filter(r => !isBefore(parseISO(r.end_date), today));

                        return (
                          <Card key={userId} className="border-2">
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-10 w-10">
                                    <AvatarImage src={userProfile?.avatar_url || ''} />
                                    <AvatarFallback>
                                      {userProfile?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??'}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <CardTitle className="text-lg">{userProfile?.full_name}</CardTitle>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Badge variant={isCLT(userProfile?.position) ? 'secondary' : 'outline'} className="text-xs">
                                        {isCLT(userProfile?.position) ? 'CLT - 30 dias corridos' : '20 dias úteis'}
                                      </Badge>
                                      {profiles.find(p => p.id === userId)?.join_date && (
                                        <span className="text-xs text-muted-foreground">
                                          Admissão: {format(parseISO(profiles.find(p => p.id === userId)!.join_date!), 'dd/MM/yyyy')}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4 text-sm">
                                  <div className="text-center">
                                    <p className="text-muted-foreground text-xs">Usufruídas</p>
                                    <p className="font-semibold text-green-600">{pastVacations.length}</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-muted-foreground text-xs">Agendadas</p>
                                    <p className="font-semibold text-blue-600">{futureVacations.length}</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-muted-foreground text-xs">Total dias</p>
                                    <p className="font-semibold">{totalApprovedDays}</p>
                                  </div>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-[180px]">Período</TableHead>
                                    <TableHead className="w-[100px]">Duração</TableHead>
                                    <TableHead className="w-[180px]">Período Aquisitivo</TableHead>
                                    <TableHead className="w-[80px]">Vendidos</TableHead>
                                    <TableHead className="w-[100px]">Status</TableHead>
                                    <TableHead className="w-[100px]">Situação</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {sortedRequests.map((request) => {
                                    const isPast = isBefore(parseISO(request.end_date), today);
                                    return (
                                      <TableRow key={request.id} className={isPast ? 'bg-green-50/50 dark:bg-green-950/20' : 'bg-blue-50/50 dark:bg-blue-950/20'}>
                                        <TableCell className="font-medium">
                                          {format(parseISO(request.start_date), 'dd/MM/yyyy')} - {format(parseISO(request.end_date), 'dd/MM/yyyy')}
                                        </TableCell>
                                        <TableCell>
                                          {request.business_days} {isCLT(userProfile?.position) ? 'dias' : 'dias úteis'}
                                        </TableCell>
                                        <TableCell>
                                          {request.acquisition_period_start && request.acquisition_period_end ? (
                                            <span className="text-sm">
                                              {format(parseISO(request.acquisition_period_start), 'dd/MM/yyyy')} - {format(parseISO(request.acquisition_period_end), 'dd/MM/yyyy')}
                                            </span>
                                          ) : (
                                            <span className="text-muted-foreground text-sm">-</span>
                                          )}
                                        </TableCell>
                                        <TableCell>
                                          {request.sold_days && request.sold_days > 0 ? (
                                            <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                                              <DollarSign className="h-3 w-3" />
                                              {request.sold_days}
                                            </Badge>
                                          ) : (
                                            <span className="text-muted-foreground text-sm">-</span>
                                          )}
                                        </TableCell>
                                        <TableCell>
                                          {getStatusBadge(request.status)}
                                        </TableCell>
                                        <TableCell>
                                          {request.status === 'approved' ? (
                                            isPast ? (
                                              <Badge variant="default" className="gap-1 bg-green-600">
                                                <CheckCircle className="h-3 w-3" />
                                                Usufruída
                                              </Badge>
                                            ) : (
                                              <Badge variant="outline" className="gap-1 border-blue-500 text-blue-600">
                                                <Clock className="h-3 w-3" />
                                                Agendada
                                              </Badge>
                                            )
                                          ) : (
                                            <span className="text-muted-foreground text-sm">-</span>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </CardContent>
                          </Card>
                        );
                      });
                    })()}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Planning Report Section - Only for admins */}
        {canManageVacations && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Relatório de Férias - Planejamento da Equipe
              </CardTitle>
              <CardDescription>
                Visualize quem estará de férias em determinado período
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Period Selection */}
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <Label>Data Inicial</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[200px] justify-start text-left font-normal",
                          !reportStartDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {reportStartDate ? format(reportStartDate, 'dd/MM/yyyy') : 'Selecione'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={reportStartDate}
                        onSelect={(date) => date && setReportStartDate(date)}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>Data Final</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[200px] justify-start text-left font-normal",
                          !reportEndDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {reportEndDate ? format(reportEndDate, 'dd/MM/yyyy') : 'Selecione'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={reportEndDate}
                        onSelect={(date) => date && setReportEndDate(date)}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setReportStartDate(startOfMonth(new Date()));
                      setReportEndDate(endOfMonth(new Date()));
                    }}
                  >
                    Este mês
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setReportStartDate(startOfMonth(addMonths(new Date(), 1)));
                      setReportEndDate(endOfMonth(addMonths(new Date(), 1)));
                    }}
                  >
                    Próximo mês
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setReportStartDate(startOfMonth(new Date()));
                      setReportEndDate(endOfMonth(addMonths(new Date(), 2)));
                    }}
                  >
                    Próx. 3 meses
                  </Button>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Período</p>
                      <p className="text-lg font-semibold">
                        {format(reportStartDate, 'dd/MM')} - {format(reportEndDate, 'dd/MM/yyyy')}
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Férias no período</p>
                      <p className="text-2xl font-bold">{getVacationsInPeriod().length}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">De férias hoje</p>
                      <p className="text-2xl font-bold text-primary">{getPeopleOnVacation(new Date()).length}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Vacation List for Period */}
              <div>
                <h4 className="font-semibold mb-3">Férias Aprovadas no Período</h4>
                {getVacationsInPeriod().length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    Nenhuma férias aprovada para este período
                  </p>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Colaborador</TableHead>
                          <TableHead>Início</TableHead>
                          <TableHead>Fim</TableHead>
                          <TableHead>Duração</TableHead>
                          <TableHead>Tipo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getVacationsInPeriod().map((request) => {
                          const isOnVacationNow = isWithinInterval(new Date(), { 
                            start: parseISO(request.start_date), 
                            end: parseISO(request.end_date) 
                          });
                          return (
                            <TableRow key={request.id} className={cn(isOnVacationNow && "bg-primary/5")}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-8 w-8">
                                    <AvatarImage src={request.profiles.avatar_url || ''} />
                                    <AvatarFallback>
                                      {request.profiles.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-medium">{request.profiles.full_name}</p>
                                    {isOnVacationNow && (
                                      <Badge variant="default" className="text-xs">De férias agora</Badge>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                {format(parseISO(request.start_date), 'dd/MM/yyyy')}
                              </TableCell>
                              <TableCell>
                                {format(parseISO(request.end_date), 'dd/MM/yyyy')}
                              </TableCell>
                              <TableCell>
                                {request.business_days} {request.profiles.position === 'administrativo' ? 'dias' : 'dias úteis'}
                              </TableCell>
                              <TableCell>
                                <Badge variant={request.profiles.position === 'administrativo' ? 'secondary' : 'outline'}>
                                  {request.profiles.position === 'administrativo' ? 'CLT' : 'Padrão'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </div>

              {/* Daily View */}
              {getVacationsInPeriod().length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">Visualização por Data</h4>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {getReportDays().map((day) => {
                        const peopleOnVacation = getPeopleOnVacation(day);
                        if (peopleOnVacation.length === 0) return null;
                        
                        const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                        const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                        
                        return (
                          <div 
                            key={day.toISOString()} 
                            className={cn(
                              "flex items-start gap-4 p-3 rounded-lg border",
                              isToday && "bg-primary/10 border-primary",
                              isWeekend && "bg-muted/50"
                            )}
                          >
                            <div className="min-w-[120px]">
                              <p className={cn("font-medium", isToday && "text-primary")}>
                                {format(day, 'EEEE', { locale: ptBR })}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {format(day, 'dd/MM/yyyy')}
                              </p>
                              {isToday && <Badge className="mt-1">Hoje</Badge>}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {peopleOnVacation.map((request) => (
                                <div key={request.id} className="flex items-center gap-1 bg-background px-2 py-1 rounded-md border">
                                  <Avatar className="h-5 w-5">
                                    <AvatarImage src={request.profiles.avatar_url || ''} />
                                    <AvatarFallback className="text-[10px]">
                                      {request.profiles.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm">{request.profiles.full_name}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        )}
          </TabsContent>

          {/* Balance Tab - Only for admins */}
          {canManageVacations && (
            <TabsContent value="balance" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5" />
                    Saldo de Férias por Colaborador
                  </CardTitle>
                  <CardDescription>
                    Selecione um colaborador para visualizar seu saldo e histórico de férias
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* User Selection and Period Filter */}
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                      <Label>Selecione o Colaborador</Label>
                      <Select value={balanceSelectedUser} onValueChange={setBalanceSelectedUser}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Escolha um colaborador para ver o saldo" />
                        </SelectTrigger>
                        <SelectContent>
                          {profiles.map((profile) => (
                            <SelectItem key={profile.id} value={profile.id}>
                              <div className="flex items-center gap-2">
                                <span>{profile.full_name}</span>
                                {isCLT(profile.position) && (
                                  <Badge variant="secondary" className="text-xs">CLT</Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {balanceSelectedUser && balanceUserAcquisitionPeriods.length > 0 && (
                      <div className="md:w-[300px]">
                        <Label>Período Aquisitivo</Label>
                        <Select value={balanceSelectedPeriod} onValueChange={setBalanceSelectedPeriod}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Filtrar por período" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">
                              <span className="font-medium">Todos os períodos</span>
                            </SelectItem>
                            {balanceUserAcquisitionPeriods.map((period) => (
                              <SelectItem key={period.value} value={period.value}>
                                {period.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {/* Balance Information */}
                  {balanceSelectedUser && balanceUserProfile && balanceUserData && (
                    <>
                      {/* User Info Card */}
                      <div className="p-4 border rounded-lg bg-muted/30">
                        <div className="flex items-center gap-4 mb-4">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={profiles.find(p => p.id === balanceSelectedUser)?.avatar_url || ''} />
                            <AvatarFallback>
                              {profiles.find(p => p.id === balanceSelectedUser)?.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-lg">
                              {profiles.find(p => p.id === balanceSelectedUser)?.full_name}
                            </p>
                            <div className="flex items-center gap-2">
                              <Badge variant={isCLT(balanceUserProfile.position) ? 'secondary' : 'outline'}>
                                {isCLT(balanceUserProfile.position) ? 'CLT - 30 dias corridos' : '20 dias úteis'}
                              </Badge>
                              {balanceUserProfile.join_date && (
                                <span className="text-sm text-muted-foreground">
                                  Ingresso em {format(parseISO(balanceUserProfile.join_date), 'dd/MM/yyyy')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Period Badge */}
                      {balanceSelectedPeriod !== 'all' && (
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="gap-1">
                            <CalendarIcon className="h-3 w-3" />
                            Período: {balanceUserAcquisitionPeriods.find(p => p.value === balanceSelectedPeriod)?.label}
                          </Badge>
                        </div>
                      )}

                      {/* Balance Stats */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="border-2">
                          <CardContent className="pt-6">
                            <div className="text-center">
                              <p className="text-sm text-muted-foreground">Total de Férias</p>
                              <p className="text-3xl font-bold">{balanceUserData.total}</p>
                              <p className="text-xs text-muted-foreground">
                                {isCLT(balanceUserProfile.position) ? 'dias corridos' : 'dias úteis'}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="border-2 border-orange-200 dark:border-orange-900">
                          <CardContent className="pt-6">
                            <div className="text-center">
                              <p className="text-sm text-muted-foreground">Dias Utilizados</p>
                              <p className="text-3xl font-bold text-orange-600">{balanceUserData.used}</p>
                              <p className="text-xs text-muted-foreground">
                                {isCLT(balanceUserProfile.position) ? 'dias corridos' : 'dias úteis'}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="border-2 border-green-200 dark:border-green-900">
                          <CardContent className="pt-6">
                            <div className="text-center">
                              <p className="text-sm text-muted-foreground">Dias Disponíveis</p>
                              <p className="text-3xl font-bold text-green-600">{balanceUserData.available}</p>
                              <p className="text-xs text-muted-foreground">
                                {isCLT(balanceUserProfile.position) ? 'dias corridos' : 'dias úteis'}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Progresso de utilização</span>
                          <span className="font-medium">
                            {Math.round((balanceUserData.used / balanceUserData.total) * 100)}%
                          </span>
                        </div>
                        <div className="h-3 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary transition-all duration-500"
                            style={{ width: `${Math.min(100, (balanceUserData.used / balanceUserData.total) * 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Chart - Vacation Distribution by Acquisition Period */}
                      {vacationChartData.length > 0 && (
                        <div className="space-y-4">
                          <h4 className="font-semibold flex items-center gap-2">
                            <BarChart3 className="h-4 w-4" />
                            Distribuição por Período Aquisitivo
                          </h4>
                          <Card className="border">
                            <CardContent className="pt-6">
                              <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={vacationChartData} layout="vertical">
                                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                  <XAxis 
                                    type="number" 
                                    domain={[0, balanceUserData.total]}
                                    tickFormatter={(value) => `${value}d`}
                                    className="text-xs"
                                  />
                                  <YAxis 
                                    type="category" 
                                    dataKey="name" 
                                    width={80}
                                    className="text-xs"
                                  />
                                  <Tooltip 
                                    content={({ active, payload }) => {
                                      if (active && payload && payload.length) {
                                        const data = payload[0].payload;
                                        return (
                                          <div className="bg-popover border rounded-lg p-3 shadow-lg">
                                            <p className="font-medium text-sm mb-2">{data.fullLabel}</p>
                                            <div className="space-y-1 text-sm">
                                              <p className="text-orange-600">Utilizado: {data.usado} dias</p>
                                              <p className="text-green-600">Disponível: {data.disponivel} dias</p>
                                              <p className="text-muted-foreground">Total: {data.total} dias</p>
                                            </div>
                                          </div>
                                        );
                                      }
                                      return null;
                                    }}
                                  />
                                  <Bar 
                                    dataKey="disponivel" 
                                    stackId="a" 
                                    fill="hsl(142 76% 36%)" 
                                    name="Disponível"
                                    radius={[0, 0, 0, 0]}
                                  />
                                  <Bar 
                                    dataKey="usado" 
                                    stackId="a" 
                                    fill="hsl(24 95% 53%)" 
                                    name="Utilizado"
                                    radius={[0, 4, 4, 0]}
                                  />
                                </BarChart>
                              </ResponsiveContainer>
                              <div className="flex justify-center gap-6 mt-4 text-sm">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(142 76% 36%)' }} />
                                  <span className="text-muted-foreground">Disponível</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(24 95% 53%)' }} />
                                  <span className="text-muted-foreground">Utilizado</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      )}

                      {/* Vacation History - Separated by Past and Future */}
                      {(() => {
                        const today = new Date();
                        const pastVacations = balanceUserRequests.filter(req => isBefore(parseISO(req.end_date), today));
                        const futureVacations = balanceUserRequests.filter(req => !isBefore(parseISO(req.end_date), today));
                        
                        return (
                          <>
                            {/* Already Enjoyed Vacations */}
                            <div className="space-y-4">
                              <h4 className="font-semibold flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                Períodos de Férias Usufruídos
                              </h4>
                              {pastVacations.length === 0 ? (
                                <div className="text-center py-6 text-muted-foreground border rounded-lg">
                                  Nenhuma férias usufruída até o momento
                                </div>
                              ) : (
                                <ScrollArea className="h-[200px]">
                                  <div className="space-y-3">
                                    {pastVacations.map((request) => (
                                      <Card key={request.id} className="border border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-950/20">
                                        <CardContent className="pt-4 pb-4">
                                          <div className="flex items-center justify-between">
                                            <div className="space-y-1">
                                              <div className="flex items-center gap-2">
                                                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                                <span className="font-medium">
                                                  {format(parseISO(request.start_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                                </span>
                                                <span>→</span>
                                                <span className="font-medium">
                                                  {format(parseISO(request.end_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                                </span>
                                              </div>
                                              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                                <span className="font-medium text-foreground">
                                                  {request.business_days} {isCLT(balanceUserProfile.position) ? 'dias corridos' : 'dias úteis'}
                                                </span>
                                                {request.acquisition_period_start && request.acquisition_period_end && (
                                                  <span>
                                                    Período aquisitivo: {format(parseISO(request.acquisition_period_start), 'dd/MM/yyyy')} - {format(parseISO(request.acquisition_period_end), 'dd/MM/yyyy')}
                                                  </span>
                                                )}
                                                {request.sold_days && request.sold_days > 0 && (
                                                  <Badge variant="secondary" className="gap-1">
                                                    <DollarSign className="h-3 w-3" />
                                                    {request.sold_days} vendidos
                                                  </Badge>
                                                )}
                                              </div>
                                              {request.notes && (
                                                <p className="text-sm text-muted-foreground mt-1">
                                                  Obs: {request.notes}
                                                </p>
                                              )}
                                            </div>
                                            <Badge variant="default" className="gap-1 bg-green-600">
                                              <CheckCircle className="h-3 w-3" />
                                              Usufruída
                                            </Badge>
                                          </div>
                                        </CardContent>
                                      </Card>
                                    ))}
                                  </div>
                                </ScrollArea>
                              )}
                            </div>

                            {/* Future Vacations (Approved but not yet enjoyed) */}
                            <div className="space-y-4">
                              <h4 className="font-semibold flex items-center gap-2">
                                <Clock className="h-4 w-4 text-blue-600" />
                                Períodos de Férias a Usufruir
                              </h4>
                              {futureVacations.length === 0 ? (
                                <div className="text-center py-6 text-muted-foreground border rounded-lg">
                                  Nenhuma férias agendada para o futuro
                                </div>
                              ) : (
                                <ScrollArea className="h-[200px]">
                                  <div className="space-y-3">
                                    {futureVacations.map((request) => (
                                      <Card key={request.id} className="border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20">
                                        <CardContent className="pt-4 pb-4">
                                          <div className="flex items-center justify-between">
                                            <div className="space-y-1">
                                              <div className="flex items-center gap-2">
                                                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                                <span className="font-medium">
                                                  {format(parseISO(request.start_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                                </span>
                                                <span>→</span>
                                                <span className="font-medium">
                                                  {format(parseISO(request.end_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                                </span>
                                              </div>
                                              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                                <span className="font-medium text-foreground">
                                                  {request.business_days} {isCLT(balanceUserProfile.position) ? 'dias corridos' : 'dias úteis'}
                                                </span>
                                                {request.acquisition_period_start && request.acquisition_period_end && (
                                                  <span>
                                                    Período aquisitivo: {format(parseISO(request.acquisition_period_start), 'dd/MM/yyyy')} - {format(parseISO(request.acquisition_period_end), 'dd/MM/yyyy')}
                                                  </span>
                                                )}
                                                {request.sold_days && request.sold_days > 0 && (
                                                  <Badge variant="secondary" className="gap-1">
                                                    <DollarSign className="h-3 w-3" />
                                                    {request.sold_days} vendidos
                                                  </Badge>
                                                )}
                                              </div>
                                              {request.notes && (
                                                <p className="text-sm text-muted-foreground mt-1">
                                                  Obs: {request.notes}
                                                </p>
                                              )}
                                            </div>
                                            <Badge variant="outline" className="gap-1 border-blue-500 text-blue-600">
                                              <Clock className="h-3 w-3" />
                                              Agendada
                                            </Badge>
                                          </div>
                                        </CardContent>
                                      </Card>
                                    ))}
                                  </div>
                                </ScrollArea>
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </>
                  )}

                  {/* Empty State */}
                  {!balanceSelectedUser && (
                    <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
                      <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="font-medium">Selecione um colaborador</p>
                      <p className="text-sm">Escolha um colaborador acima para visualizar seu saldo de férias</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {canManageVacations && (
            <TabsContent value="dashboard" className="mt-6">
              <VacationDashboard 
                onEditRequest={openEditDialog}
                onDeleteRequest={handleDelete}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Período de Férias</DialogTitle>
            <DialogDescription>
              Altere as datas do período de férias
            </DialogDescription>
          </DialogHeader>
          {editingRequest && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-md">
                <p className="font-medium">{editingRequest.profiles.full_name}</p>
                <p className="text-sm text-muted-foreground">
                  Status: {editingRequest.status === 'approved' ? 'Aprovada' : editingRequest.status === 'pending' ? 'Pendente' : 'Rejeitada'}
                </p>
              </div>
              <div>
                <Label>Data de Início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !editStartDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editStartDate ? format(editStartDate, 'PPP', { locale: ptBR }) : 'Selecione a data'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={editStartDate}
                      onSelect={setEditStartDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Data de Fim</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !editEndDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editEndDate ? format(editEndDate, 'PPP', { locale: ptBR }) : 'Selecione a data'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={editEndDate}
                      onSelect={setEditEndDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              {editStartDate && editEndDate && (
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm font-medium">
                    {isCLT(editingRequest.profiles.position) ? 'Dias corridos' : 'Dias úteis'}: {calculateDays(editStartDate, editEndDate, editingRequest.profiles.position)}
                  </p>
                </div>
              )}
              {/* Período Aquisitivo */}
              <div className="space-y-2">
                <Label className="font-medium">Período Aquisitivo (opcional)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Início</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !editAcquisitionStart && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-3 w-3" />
                          {editAcquisitionStart ? format(editAcquisitionStart, 'dd/MM/yyyy') : 'Selecione'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={editAcquisitionStart}
                          onSelect={setEditAcquisitionStart}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Fim</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !editAcquisitionEnd && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-3 w-3" />
                          {editAcquisitionEnd ? format(editAcquisitionEnd, 'dd/MM/yyyy') : 'Selecione'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={editAcquisitionEnd}
                          onSelect={setEditAcquisitionEnd}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
              {/* Dias Vendidos */}
              <div>
                <Label className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Dias Vendidos (opcional)
                </Label>
                <Input
                  type="number"
                  min="0"
                  max="10"
                  value={editSoldDays || ''}
                  onChange={(e) => setEditSoldDays(parseInt(e.target.value) || 0)}
                  placeholder="0"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">Dias de férias vendidos ao escritório (abono pecuniário)</p>
              </div>
              <div>
                <Label>Observações (opcional)</Label>
                <Textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Adicione observações"
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button onClick={handleEditRequest} className="flex-1">
                  Salvar Alterações
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
