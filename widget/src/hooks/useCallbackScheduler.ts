/**
 * useCallbackScheduler — State management hook for premium callback scheduling.
 *
 * Uses REST API (not WebSocket) to schedule callbacks and fetch available slots.
 * This keeps the callback flow decoupled from the chat WebSocket connection.
 */

import { useState, useCallback } from 'react';

export interface CallbackRequest {
  phone: string;
  name?: string;
  date: string;            // ISO date: '2026-02-21'
  timeSlot: 'morning' | 'midday' | 'afternoon';
  timeRange: string;       // '09:00-12:00'
  businessLine?: string;
  note?: string;
  visitorId: string;
  language: string;
  conversationId?: string;
}

export interface CallbackResult {
  success: boolean;
  callbackId?: string;
  scheduledFor?: string;
  error?: string;
}

export interface TimeSlotInfo {
  slot: 'morning' | 'midday' | 'afternoon';
  timeRange: string;
  available: boolean;
  agentCount: number;
}

export function useCallbackScheduler(baseUrl: string, visitorId: string) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<CallbackResult | null>(null);
  const [availableSlots, setAvailableSlots] = useState<TimeSlotInfo[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const apiBase = baseUrl.replace(/\/widget\/?$/, '');

  const schedule = useCallback(async (data: CallbackRequest): Promise<CallbackResult> => {
    setIsSubmitting(true);
    setResult(null);
    try {
      const res = await fetch(`${apiBase}/api/callbacks/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': 'widget' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (res.ok && json.callbackId) {
        const r: CallbackResult = { success: true, callbackId: json.callbackId, scheduledFor: json.scheduledFor };
        setResult(r);
        setIsSubmitting(false);
        return r;
      } else {
        const r: CallbackResult = { success: false, error: json.error || 'Error al programar callback' };
        setResult(r);
        setIsSubmitting(false);
        return r;
      }
    } catch (e) {
      const r: CallbackResult = { success: false, error: 'Error de red. Inténtalo de nuevo.' };
      setResult(r);
      setIsSubmitting(false);
      return r;
    }
  }, [apiBase]);

  const fetchSlots = useCallback(async (date: string, businessLine?: string) => {
    setSlotsLoading(true);
    try {
      const params = new URLSearchParams();
      if (businessLine) params.set('businessLine', businessLine);
      const res = await fetch(`${apiBase}/api/callbacks/slots/${date}?${params.toString()}`, {
        headers: { 'X-API-Key': 'widget' },
      });
      if (res.ok) {
        const json = await res.json();
        setAvailableSlots(json.slots || []);
      }
    } catch {
      // Silently fail — slots will show default availability
    } finally {
      setSlotsLoading(false);
    }
  }, [apiBase]);

  const reset = useCallback(() => {
    setResult(null);
    setIsSubmitting(false);
    setAvailableSlots([]);
  }, []);

  return {
    schedule,
    isSubmitting,
    result,
    availableSlots,
    slotsLoading,
    fetchSlots,
    reset,
  };
}
