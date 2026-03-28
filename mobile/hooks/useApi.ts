import { useState, useEffect } from 'react';
import { symptomService, locationService, herbService } from '../services/apiServices';
import { Herb } from '../shared/types/herb.types';



// Fetch recommendations based on symptoms
export const useSymptomRecommendations = (
  symptomIds: string[] | null,
  ageGroup: string | null,
  gender: string | null,
  options: { medications?: string[]; conditions?: string[]; allergies?: string[]; severity?: string; isPregnant?: boolean; isBreastfeeding?: boolean } = {},
) => {
  const [recommendations, setRecommendations] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const medicationsKey = Array.isArray(options?.medications) ? options.medications.join('|') : '';

  const fetchRecommendations = async () => {
    if (!symptomIds || !symptomIds.length || !ageGroup || !gender) return;

    try {
      setLoading(true);
      setError(null);
      console.log('🔍 Fetching symptom-based recommendations:', { symptomIds, ageGroup, gender });
      const data = await symptomService.getRecommendationsBySymptoms(symptomIds, ageGroup, gender, options);
      console.log('✅ Successfully fetched symptom recommendations:', data);
      setRecommendations(data);
    } catch (err: any) {
      console.error('❌ Error fetching symptom recommendations:', err);
      setError(err.message || 'Failed to fetch symptom recommendations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, [
    symptomIds,
    ageGroup,
    gender,
    medicationsKey,
    options?.conditions?.join('|'),
    options?.allergies?.join('|'),
    options?.severity,
    options?.isPregnant,
    options?.isBreastfeeding
  ]);

  return {
    recommendations,
    loading,
    error,
    refetch: fetchRecommendations
  };
};

// Fetch all symptoms
export const useSymptoms = () => {
  const [symptoms, setSymptoms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSymptoms = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔍 Fetching symptoms...');
      const data = await symptomService.getAllSymptoms();
      console.log('✅ Successfully fetched symptoms:', data);
      setSymptoms(data as any);
    } catch (err: any) {
      console.error('❌ Error fetching symptoms:', err);
      setError(err.message || 'Failed to fetch symptoms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSymptoms();
  }, []);

  const refetch = () => {
    fetchSymptoms();
  };

  return {
    symptoms,
    loading,
    error,
    refetch
  };
};

export const useHerbs = () => {
  const [herbs, setHerbs] = useState<Herb[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHerbs = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔍 Fetching herbs...');
      const data: any = await herbService.getAllHerbs();
      console.log('✅ Successfully fetched herbs:', data);
      // Handle response format { data: [...], success: true }
      if (data.data && Array.isArray(data.data)) {
        setHerbs(data.data);
      } else if (Array.isArray(data)) {
        setHerbs(data);
      } else {
        console.warn('useHerbs: Unexpected data format', data);
        setHerbs([]);
      }
    } catch (err: any) {
      console.error('❌ Error fetching herbs:', err);
      setError(err.message || 'Failed to fetch herbs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHerbs();
  }, []);

  return {
    herbs,
    loading,
    error,
    refetch: fetchHerbs
  };
};

export const useLocations = () => {
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      setError(null);
      const data: any = await locationService.getAllLocations();
      // the controller returns { locations: [...], pagination: {...} }
      if (data.locations && Array.isArray(data.locations)) {
        setLocations(data.locations);
      } else if (Array.isArray(data)) {
        setLocations(data);
      } else {
        console.warn('useLocations: Unexpected data format', data);
        setLocations([]);
      }
    } catch (err: any) {
      console.error('Error in useLocations:', err);
      setError(err.message || 'Failed to fetch locations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  return {
    locations,
    loading,
    error,
    refetch: fetchLocations
  };
};
