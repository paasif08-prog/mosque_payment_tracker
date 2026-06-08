'use client';

import React, { useState, useEffect, use, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserClientInstance } from '@/lib/supabase';
import DatePicker from '@/components/DatePicker';
import { formatCurrency, formatDate } from '@/lib/dueUtils';
import { getDonorId, decodeExternalDonorId, aggregateDonors, Donation } from '@/lib/donorUtils';
import {
  Heart,
  ArrowLeft,
  Calendar,
  Phone,
  Plus,
  X,
  FileText,
  User,
  ChevronRight,
  IndianRupee,
  Activity,
  Award,
  Edit3,
  Trash2,
  Printer,
} from 'lucide-react';

interface MemberDetails {
  id: string;
  full_name: string;
  phone: string;
}

export default function DonorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const donorProfileId = resolvedParams.id;

  const supabase = createBrowserClientInstance();
  const router = useRouter();

  // Data States
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [memberDetails, setMemberDetails] = useState<MemberDetails | null>(null);

  // Form Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<'General' | 'Sahar' | 'Iftar'>('General');
  const [notes, setNotes] = useState('');
  const [donationDate, setDonationDate] = useState(formatDate(new Date()));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Edit & Delete Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingDonation, setEditingDonation] = useState<Donation | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingDonation, setDeletingDonation] = useState<Donation | null>(null);
  const [editDonorName, setEditDonorName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  // Donor Mini Report Printing State
  const [isPrintingReport, setIsPrintingReport] = useState(false);

  const handleGenerateReport = () => {
    setIsPrintingReport(true);
    setTimeout(() => {
      window.print();
      setIsPrintingReport(false);
    }, 150);
  };

  // Notes viewer state
  const [viewingNotesDonation, setViewingNotesDonation] = useState<Donation | null>(null);

  // Grouped timeline expanded states
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroupExpand = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const renderNotes = (note: string | null, donation: Donation) => {
    if (!note || !note.trim()) {
      return <span className="text-slate-600 italic text-xs">No notes</span>;
    }
    if (note.length <= 35) {
      return (
        <span className="cursor-help text-slate-300 border-b border-dashed border-slate-700 text-xs font-medium" title={note}>
          {note}
        </span>
      );
    }
    return (
      <button
        type="button"
        onClick={() => setViewingNotesDonation(donation)}
        className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition text-left text-xs"
        title="Click to open modal notes"
      >
        <span className="cursor-help border-b border-dashed border-slate-700 truncate max-w-[120px] block font-medium" title={note}>
          {note}
        </span>
        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
      </button>
    );
  };

  // Pagination state for history table
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch all donations to build ranking and filter details
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('donations')
        .select('*')
        .order('donation_date', { ascending: false });

      if (error) throw error;
      setDonations(data || []);

      // If this is a member profile, fetch the member's details
      if (donorProfileId.startsWith('member_')) {
        const memberId = donorProfileId.substring(7);
        const { data: memberData } = await supabase
          .from('members')
          .select('id, full_name, phone')
          .eq('id', memberId)
          .single();
        if (memberData) {
          setMemberDetails(memberData);
        }
      }
    } catch (err) {
      console.error('Error fetching donor profile data:', err);
    } finally {
      setLoading(false);
    }
  }, [donorProfileId, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Aggregate all donors to compute statistics and rankings
  const donorProfiles = useMemo(() => {
    return aggregateDonors(donations);
  }, [donations]);

  // Find current donor profile
  const currentProfile = useMemo(() => {
    return donorProfiles.find((p) => p.id === donorProfileId);
  }, [donorProfiles, donorProfileId]);

  // Calculate ranking
  const ranking = useMemo(() => {
    return donorProfiles.findIndex((p) => p.id === donorProfileId) + 1;
  }, [donorProfiles, donorProfileId]);

  // Group donations by Year and Month for Timeline
  const timelineData = useMemo(() => {
    if (!currentProfile) return [];
    
    // Year -> Month -> Category -> list of donations
    const groups: { [year: string]: { [month: string]: { [category: string]: Donation[] } } } = {};
    
    currentProfile.donations.forEach((d) => {
      const date = new Date(d.donation_date);
      const year = date.getFullYear().toString();
      const month = date.toLocaleDateString(undefined, { month: 'long' });
      const category = d.category;
      
      if (!groups[year]) groups[year] = {};
      if (!groups[year][month]) groups[year][month] = {};
      if (!groups[year][month][category]) groups[year][month][category] = [];
      
      groups[year][month][category].push(d);
    });

    // Now build the structured array
    return Object.keys(groups)
      .sort((a, b) => Number(b) - Number(a))
      .map((year) => {
        const monthsArray = Object.keys(groups[year]).map((month) => {
          const categories = Object.keys(groups[year][month]).map((cat) => {
            const donations = groups[year][month][cat].sort((a, b) => b.donation_date.localeCompare(a.donation_date));
            const total = donations.reduce((sum, d) => sum + Number(d.amount), 0);
            const count = donations.length;
            return {
              category: cat as 'General' | 'Sahar' | 'Iftar',
              total,
              count,
              donations,
            };
          });

          const monthTotal = categories.reduce((sum, c) => sum + c.total, 0);

          return {
            month,
            total: monthTotal,
            categories,
          };
        });

        // Sort months descending based on latest donation date in that month
        monthsArray.sort((a, b) => {
          const dateA = a.categories[0]?.donations[0]?.donation_date || '';
          const dateB = b.categories[0]?.donations[0]?.donation_date || '';
          return dateB.localeCompare(dateA);
        });

        return {
          year,
          months: monthsArray,
        };
      });
  }, [currentProfile]);

  // Parse details for external donors if not loaded yet
  const decodedExternalDetails = useMemo(() => {
    if (donorProfileId.startsWith('ext_')) {
      return decodeExternalDonorId(donorProfileId);
    }
    return null;
  }, [donorProfileId]);

  // Display metadata
  const donorName = currentProfile?.donor_name || memberDetails?.full_name || decodedExternalDetails?.donor_name || 'Donor Profile';
  const donorPhone = currentProfile?.phone || memberDetails?.phone || decodedExternalDetails?.phone || null;
  const isMember = donorProfileId.startsWith('member_');

  // Pagination bounds
  const donorDonations = currentProfile?.donations || [];
  const totalItems = donorDonations.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedDonations = donorDonations.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Record Donation under pre-selected profile
  const handleSaveDonation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum <= 0) {
      setFormError('Please enter a valid donation amount greater than 0.');
      setIsSubmitting(false);
      return;
    }

    try {
      let finalMemberId: string | null = null;
      const finalDonorName = donorName;
      const finalPhone = donorPhone;

      if (isMember) {
        finalMemberId = donorProfileId.substring(7);
      }

      const { error } = await supabase.from('donations').insert({
        member_id: finalMemberId,
        donor_name: finalDonorName,
        phone: finalPhone,
        amount: amtNum,
        category,
        notes: notes.trim() || null,
        donation_date: donationDate,
      });

      if (error) throw error;

      // Reset modal inputs
      setAmount('');
      setCategory('General');
      setNotes('');
      setDonationDate(formatDate(new Date()));
      setIsAddModalOpen(false);

      // Refresh page data
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record donation.';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit & Delete Handlers
  const handleOpenEditModal = (donation: Donation) => {
    setEditingDonation(donation);
    setCategory(donation.category);
    setAmount(donation.amount.toString());
    setDonationDate(donation.donation_date);
    setNotes(donation.notes || '');
    setFormError(null);

    setEditDonorName(donation.donor_name);
    setEditPhone(donation.phone || '');
    setIsEditModalOpen(true);
  };

  const handleOpenDeleteModal = (donation: Donation) => {
    setDeletingDonation(donation);
    setIsDeleteModalOpen(true);
  };

  const handleSaveEditDonation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDonation) return;

    setIsSubmitting(true);
    setFormError(null);

    let finalDonorName = '';
    let finalPhone = editPhone.trim() || null;

    if (editingDonation.member_id) {
      finalDonorName = editingDonation.donor_name;
      finalPhone = editingDonation.phone;
    } else {
      const trimmedName = editDonorName.trim();
      if (!trimmedName) {
        setFormError('Donor name is required.');
        setIsSubmitting(false);
        return;
      }
      finalDonorName = trimmedName;
    }

    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum <= 0) {
      setFormError('Please enter a valid donation amount greater than 0.');
      setIsSubmitting(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('donations')
        .update({
          donor_name: finalDonorName,
          phone: finalPhone,
          amount: amtNum,
          category,
          notes: notes.trim() || null,
          donation_date: donationDate,
        })
        .eq('id', editingDonation.id);

      if (error) throw error;

      setIsEditModalOpen(false);
      setEditingDonation(null);
      setAmount('');
      setCategory('General');
      setNotes('');
      setDonationDate(formatDate(new Date()));

      // Calculate if the URL profile ID needs to change
      const newDonorId = getDonorId(editingDonation.member_id, finalDonorName, finalPhone);
      if (newDonorId !== donorProfileId) {
        router.push(`/dashboard/donations/donor/${newDonorId}`);
      } else {
        await fetchData();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update donation.';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingDonation) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('donations')
        .delete()
        .eq('id', deletingDonation.id);

      if (error) throw error;

      setIsDeleteModalOpen(false);
      setDeletingDonation(null);
      
      // If we deleted the last donation, redirect to donations listing
      if (donorDonations.length <= 1) {
        router.push('/dashboard/donations');
      } else {
        await fetchData();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete donation.';
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading && !currentProfile) {
    return (
      <div className="flex h-96 flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900/20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        <p className="text-sm text-slate-500 mt-3">Loading donor profile...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Main Page Layout (hidden during report printing) */}
      <div className={isPrintingReport ? 'print:hidden' : ''}>
        {/* Back navigation & Action Row */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <Link
            href="/dashboard/donations"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-slate-200 transition"
          >
            <ArrowLeft className="h-4.5 w-4.5" /> Back to Donations
          </Link>
          <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-center">
            <button
              onClick={handleGenerateReport}
              className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:text-white transition shadow-md"
            >
              <Printer className="h-4 w-4" />
              Generate Donor Report
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition duration-150 shadow-md"
            >
              <Plus className="h-5 w-5" />
              Add Donation
            </button>
          </div>
        </div>

      {/* Profile Header */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur-md relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-indigo-500/10 blur-3xl" />
        
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {isMember ? <Award className="h-7 w-7 text-indigo-400" /> : <User className="h-7 w-7 text-emerald-400" />}
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-2xl font-bold text-white">{donorName}</h2>
                <span
                  className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
                    isMember
                      ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}
                >
                  {isMember ? 'Member Donor' : 'External Donor'}
                </span>
                {ranking > 0 && ranking <= 3 && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-400 border border-amber-500/20">
                    🏆 Rank #{ranking} Top Donor
                  </span>
                )}
                {ranking > 3 && ranking <= 10 && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-300/10 px-2 py-0.5 text-xs font-bold text-slate-300 border border-slate-300/20">
                    ⭐ Rank #{ranking}
                  </span>
                )}
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-x-4 gap-y-1 text-sm text-slate-400">
                {donorPhone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-slate-500" /> {donorPhone}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-slate-500" /> Donor Since:{' '}
                  <strong className="text-slate-300">
                    {currentProfile ? new Date(currentProfile.firstDonationDate).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—'}
                  </strong>
                </span>
              </div>
            </div>
          </div>
          
          {isMember && memberDetails && (
            <Link
              href={`/dashboard/members/${memberDetails.id}`}
              className="inline-flex items-center gap-1.5 self-start md:self-center rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-indigo-400 hover:text-indigo-300 hover:border-slate-700 transition"
            >
              View Member Profile <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>

      {/* Summary Metrics Cards */}
      <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        {/* Total Lifetime */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 shadow-md backdrop-blur-md">
          <span className="text-xs font-semibold text-slate-400 block mb-1">Total Donated</span>
          <span className="text-3xl font-extrabold text-white">
            {formatCurrency(currentProfile?.lifetimeTotal || 0)}
          </span>
          <p className="text-[10px] text-slate-500 mt-1">Lifetime total contribution</p>
        </div>

        {/* Total Donations Count */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 shadow-md backdrop-blur-md">
          <span className="text-xs font-semibold text-slate-400 block mb-1">Total Donations</span>
          <span className="text-3xl font-extrabold text-indigo-400">
            {currentProfile?.donationCount || 0}
          </span>
          <p className="text-[10px] text-slate-500 mt-1">Total contribution events</p>
        </div>

        {/* Largest Contribution */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 shadow-md backdrop-blur-md">
          <span className="text-xs font-semibold text-slate-400 block mb-1">Largest Contribution</span>
          <span className="text-3xl font-extrabold text-emerald-400">
            {formatCurrency(currentProfile?.largestDonation || 0)}
          </span>
          <p className="text-[10px] text-slate-500 mt-1">Largest single donation</p>
        </div>

        {/* Category Breakdown */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 shadow-md backdrop-blur-md">
          <span className="text-xs font-semibold text-slate-400 block mb-2">Category Subtotals</span>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">General:</span>
              <span className="font-semibold text-slate-200">{formatCurrency(currentProfile?.generalTotal || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Sahar:</span>
              <span className="font-semibold text-slate-200">{formatCurrency(currentProfile?.saharTotal || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Iftar:</span>
              <span className="font-semibold text-slate-200">{formatCurrency(currentProfile?.iftarTotal || 0)}</span>
            </div>
          </div>
        </div>

        {/* Latest Activity */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 shadow-md backdrop-blur-md">
          <span className="text-xs font-semibold text-slate-400 block mb-1">Latest Donation Date</span>
          <span className="text-xl font-bold text-blue-400">
            {currentProfile?.latestDonationDate ? new Date(currentProfile.latestDonationDate).toLocaleDateString(undefined, { dateStyle: 'long' }) : '—'}
          </span>
          <p className="text-[10px] text-slate-500 mt-1.5">Latest recorded donation activity</p>
        </div>
      </div>

      {/* Main Grid: Left Timeline, Right History list */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {/* Left Column: Timeline */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
            <Activity className="h-5 w-5 text-indigo-400" /> Donation Timeline
          </h3>

          <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-5 shadow-md backdrop-blur-md space-y-6 relative">
            <div className="absolute left-7 top-6 bottom-6 w-0.5 bg-slate-800" />
            
            {timelineData.length === 0 ? (
              <p className="text-xs text-slate-500 italic text-center py-4">No donation timeline logs found</p>
            ) : (
              timelineData.map((yGroup) => (
                <div key={yGroup.year} className="space-y-4 relative z-10">
                  <div className="flex items-center gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-900 border border-slate-800 text-[10px] font-bold text-slate-400">
                      {yGroup.year}
                    </span>
                    <h4 className="text-sm font-extrabold text-slate-200">{yGroup.year} Timeline</h4>
                  </div>

                  <div className="pl-6 space-y-5">
                    {yGroup.months.map((mGroup, mIdx) => (
                      <div key={mIdx} className="space-y-3">
                        <div className="flex justify-between items-center text-xs border-b border-slate-850 pb-1.5">
                          <span className="font-bold text-slate-200 text-sm">{mGroup.month}</span>
                          <span className="font-extrabold text-slate-200">
                            Total: <span className="text-white">{formatCurrency(mGroup.total)}</span>
                          </span>
                        </div>
                        <div className="space-y-3 pl-2">
                          {mGroup.categories.map((cGroup) => {
                            const groupKey = `${yGroup.year}-${mGroup.month}-${cGroup.category}`;
                            const isExpanded = expandedGroups.has(groupKey);
                            return (
                              <div key={cGroup.category} className="space-y-2">
                                <div className="flex justify-between items-center text-xs">
                                  <div className="flex flex-col">
                                    <span className="font-semibold text-indigo-400">{cGroup.category}</span>
                                    <span className="text-[10px] text-slate-500">
                                      ({cGroup.count} {cGroup.count === 1 ? 'donation' : 'donations'})
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-300">{formatCurrency(cGroup.total)}</span>
                                    <button
                                      onClick={() => toggleGroupExpand(groupKey)}
                                      className="text-[10px] font-semibold text-slate-500 hover:text-slate-300 flex items-center gap-0.5 border border-slate-800 rounded px-1.5 py-0.5 bg-slate-900/50 transition"
                                    >
                                      {isExpanded ? '▲ Hide' : '▼ View'}
                                    </button>
                                  </div>
                                </div>
                                {isExpanded && (
                                  <div className="pl-3 py-1.5 border-l border-indigo-500/20 space-y-1.5">
                                    {cGroup.donations.map((item) => (
                                      <div key={item.id} className="flex justify-between items-center text-[10px] text-slate-400">
                                        <span>
                                          {new Date(item.donation_date).toLocaleDateString(undefined, {
                                            dateStyle: 'medium',
                                          })}
                                        </span>
                                        <span className="font-semibold text-slate-300">{formatCurrency(item.amount)}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right 2 Columns: Full History Table */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-400" /> Donation History Records
          </h3>

          <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-5 shadow-md backdrop-blur-md space-y-4">
            {paginatedDonations.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-10 text-center">No donations registered for this donor.</p>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto rounded-lg border border-slate-800">
                  <table className="w-full border-collapse text-left text-xs text-slate-300">
                    <thead className="bg-slate-900/60 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="p-3">Donation Date</th>
                        <th className="p-3">Category</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Source</th>
                        <th className="p-3">Notes</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {paginatedDonations.map((donation) => (
                        <tr key={donation.id} className="hover:bg-slate-900/20 transition">
                          <td className="p-3 text-slate-200 font-medium">
                            {new Date(donation.donation_date).toLocaleDateString(undefined, {
                              dateStyle: 'medium',
                            })}
                          </td>
                          <td className="p-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                                donation.category === 'General'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : donation.category === 'Sahar'
                                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              }`}
                            >
                              {donation.category}
                            </span>
                          </td>
                          <td className="p-3 font-bold text-emerald-400">
                            {formatCurrency(donation.amount)}
                          </td>
                          <td className="p-3 text-slate-400">{isMember ? 'Member' : 'External'}</td>
                          <td className="p-3 text-slate-400">
                            {renderNotes(donation.notes, donation)}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleOpenEditModal(donation)}
                                className="p-1 rounded text-slate-400 hover:bg-slate-800 hover:text-blue-400 transition"
                                title="Edit"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleOpenDeleteModal(donation)}
                                className="p-1 rounded text-slate-400 hover:bg-slate-800 hover:text-red-400 transition"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-slate-800 pt-4 text-xs text-slate-400">
                    <span>
                      Showing <span className="text-slate-200">{startIndex + 1}</span> to{' '}
                      <span className="text-slate-200">
                        {Math.min(startIndex + itemsPerPage, totalItems)}
                      </span>{' '}
                      of <span className="text-slate-200">{totalItems}</span> records
                    </span>
                    <div className="flex gap-2">
                      <button
                        disabled={currentPage === 1}
                        onClick={() => handlePageChange(currentPage - 1)}
                        className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 hover:text-white disabled:opacity-40 disabled:hover:text-slate-400 transition"
                      >
                        Previous
                      </button>
                      <button
                        disabled={currentPage === totalPages}
                        onClick={() => handlePageChange(currentPage + 1)}
                        className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 hover:text-white disabled:opacity-40 disabled:hover:text-slate-400 transition"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      </div>

      {/* Printable Report (visible only during print) */}
      {isPrintingReport && (
        <div className="hidden print:block bg-white text-slate-900 p-8 min-h-screen">
          <div className="border-b-2 border-slate-900 pb-4 mb-6 text-left">
            <h1 className="text-2xl font-bold uppercase tracking-wide">Donor Contribution Statement</h1>
            <p className="text-xs text-slate-500 mt-1">Generated on {new Date().toLocaleDateString(undefined, { dateStyle: 'long' })}</p>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-8 text-sm text-left">
            <div>
              <h3 className="font-bold text-slate-800 uppercase text-xs tracking-wider mb-2">Donor Information</h3>
              <p className="font-semibold text-base text-slate-900">{donorName}</p>
              <p className="text-slate-600 mt-1">Phone: {donorPhone || '—'}</p>
              <p className="text-slate-600">Source: {isMember ? 'Member' : 'External'}</p>
            </div>
            <div>
              <h3 className="font-bold text-slate-800 uppercase text-xs tracking-wider mb-2">Contribution Summary</h3>
              <p className="text-slate-600">Total Donated: <strong className="text-slate-900 font-bold">{formatCurrency(currentProfile?.lifetimeTotal || 0)}</strong></p>
              <p className="text-slate-600">Donation Count: <strong className="text-slate-900 font-bold">{currentProfile?.donationCount || 0}</strong></p>
              <div className="mt-2 space-y-1 text-xs border-t pt-2 border-slate-200">
                <div className="flex justify-between max-w-xs">
                  <span>General Total:</span>
                  <span className="font-semibold">{formatCurrency(currentProfile?.generalTotal || 0)}</span>
                </div>
                <div className="flex justify-between max-w-xs">
                  <span>Sahar Total:</span>
                  <span className="font-semibold">{formatCurrency(currentProfile?.saharTotal || 0)}</span>
                </div>
                <div className="flex justify-between max-w-xs">
                  <span>Iftar Total:</span>
                  <span className="font-semibold">{formatCurrency(currentProfile?.iftarTotal || 0)}</span>
                </div>
              </div>
            </div>
          </div>

          <h3 className="font-bold text-slate-800 uppercase text-xs tracking-wider mb-3 text-left">Complete Transaction History</h3>
          <table className="w-full text-left text-xs border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-350">
                <th className="p-2.5 border border-slate-300">Date</th>
                <th className="p-2.5 border border-slate-300">Category</th>
                <th className="p-2.5 border border-slate-300">Amount</th>
                <th className="p-2.5 border border-slate-300">Notes</th>
              </tr>
            </thead>
            <tbody>
              {donorDonations.map((d) => (
                <tr key={d.id} className="border-b border-slate-200">
                  <td className="p-2.5 border border-slate-300">
                    {new Date(d.donation_date).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                  </td>
                  <td className="p-2.5 border border-slate-300">{d.category}</td>
                  <td className="p-2.5 border border-slate-300 font-semibold">{formatCurrency(d.amount)}</td>
                  <td className="p-2.5 border border-slate-300 italic text-slate-600">{d.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Log Donation Modal (Prefilled and locked) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setIsAddModalOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl animate-scale-up text-left z-10">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 animate-pulse">
                <Heart className="h-5 w-5 fill-indigo-400/20" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Log Donation</h3>
                <p className="text-xs text-slate-400">Record a contribution under this profile.</p>
              </div>
            </div>

            {formError && (
              <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3.5 text-sm text-red-400">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveDonation} className="mt-4 space-y-4">
              {/* Selected Profile Indicator */}
              <div className="p-3.5 rounded-lg border border-indigo-500/10 bg-indigo-500/5">
                <span className="text-[10px] uppercase font-bold text-indigo-400 block tracking-wider">Donor Profile Profile</span>
                <span className="text-sm font-bold text-slate-200 block mt-0.5">{donorName}</span>
                {donorPhone && <span className="text-xs text-slate-500">{donorPhone}</span>}
              </div>

              {/* Category & Amount */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as 'General' | 'Sahar' | 'Iftar')}
                    className="block w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="General">General</option>
                    <option value="Sahar">Sahar</option>
                    <option value="Iftar">Iftar</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Amount (₹) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                      <IndianRupee className="h-4 w-4" />
                    </div>
                    <input
                      type="number"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="1000"
                      className="block w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Donation Date */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Donation Date <span className="text-red-500">*</span>
                </label>
                <DatePicker
                  value={donationDate}
                  onChange={setDonationDate}
                  required
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ramadan contribution details, cheque info, receipts, etc."
                  rows={3}
                  className="block w-full rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-slate-400 hover:text-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Recording...' : 'Record Donation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Viewing Notes Modal */}
      {viewingNotesDonation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setViewingNotesDonation(null)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl animate-scale-up text-left z-10">
            <button
              onClick={() => setViewingNotesDonation(null)}
              className="absolute top-4 right-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Donation Notes</h3>
                <p className="text-xs text-slate-400">For {viewingNotesDonation.donor_name}</p>
              </div>
            </div>
            <div className="mt-4 p-4 rounded-lg bg-slate-950 border border-slate-850 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
              {viewingNotesDonation.notes}
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setViewingNotesDonation(null)}
                className="rounded-lg bg-slate-800 border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:text-white transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Donation Modal */}
      {isEditModalOpen && editingDonation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => {
              setIsEditModalOpen(false);
              setEditingDonation(null);
            }}
          />
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl animate-scale-up text-left z-10">
            <button
              onClick={() => {
                setIsEditModalOpen(false);
                setEditingDonation(null);
              }}
              className="absolute top-4 right-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 animate-pulse">
                <Heart className="h-5 w-5 fill-indigo-400/20" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Edit Donation</h3>
                <p className="text-xs text-slate-400">Modify donation record details.</p>
              </div>
            </div>

            {formError && (
              <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3.5 text-sm text-red-400">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveEditDonation} className="mt-4 space-y-4">
              {/* If member donation, lock name and phone display */}
              {editingDonation.member_id ? (
                <div className="p-3.5 rounded-lg border border-indigo-500/10 bg-indigo-500/5">
                  <span className="text-[10px] uppercase font-bold text-indigo-400 block tracking-wider">Member Donor (Locked)</span>
                  <span className="text-sm font-bold text-slate-200 block mt-0.5">{editingDonation.donor_name}</span>
                  {editingDonation.phone && <span className="text-xs text-slate-500">{editingDonation.phone}</span>}
                </div>
              ) : (
                /* If external donation, allow modifying donor name and phone */
                <>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Donor Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                        <User className="h-4 w-4" />
                      </div>
                      <input
                        type="text"
                        required
                        value={editDonorName}
                        onChange={(e) => setEditDonorName(e.target.value)}
                        placeholder="Jane Smith"
                        className="block w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Phone Number (Optional)
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                        <Phone className="h-4 w-4" />
                      </div>
                      <input
                        type="text"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder="+91 XXXXX XXXXX"
                        className="block w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Category & Amount */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as 'General' | 'Sahar' | 'Iftar')}
                    className="block w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="General">General</option>
                    <option value="Sahar">Sahar</option>
                    <option value="Iftar">Iftar</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Amount (₹) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                      <IndianRupee className="h-4 w-4" />
                    </div>
                    <input
                      type="number"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="1000"
                      className="block w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Donation Date */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Donation Date <span className="text-red-500">*</span>
                </label>
                <DatePicker
                  value={donationDate}
                  onChange={setDonationDate}
                  required
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ramadan contribution details, cheque info, receipts, etc."
                  rows={3}
                  className="block w-full rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingDonation(null);
                  }}
                  className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-slate-400 hover:text-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && deletingDonation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => {
              setIsDeleteModalOpen(false);
              setDeletingDonation(null);
            }}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl animate-scale-up text-left z-10">
            <button
              onClick={() => {
                setIsDeleteModalOpen(false);
                setDeletingDonation(null);
              }}
              className="absolute top-4 right-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="pb-4 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">Delete Donation</h3>
              <p className="text-xs text-slate-400 mt-1">Are you sure you want to permanently delete this donation?</p>
            </div>

            <div className="my-6 space-y-3.5 p-4 rounded-xl bg-slate-950 border border-slate-850">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Donation Amount:</span>
                <span className="font-extrabold text-red-400 text-lg">{formatCurrency(deletingDonation.amount)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Donor Name:</span>
                <span className="font-bold text-slate-200">{deletingDonation.donor_name}</span>
              </div>
              {deletingDonation.donation_date && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Donation Date:</span>
                  <span className="font-semibold text-slate-400">{formatDate(new Date(deletingDonation.donation_date))}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeletingDonation(null);
                }}
                className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-slate-400 hover:text-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isSubmitting}
                className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 transition disabled:opacity-50"
              >
                {isSubmitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
