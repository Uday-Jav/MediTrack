INSERT INTO patient_records (
  patient_id,
  name,
  age,
  gender,
  allergies,
  conditions,
  medications,
  recent_symptoms,
  last_visit
)
VALUES (
  'patient_001',
  'Aarav Sharma',
  34,
  'male',
  ARRAY['penicillin'],
  ARRAY['seasonal allergies'],
  ARRAY['cetirizine'],
  ARRAY['mild cough', 'sore throat'],
  CURRENT_DATE - INTERVAL '21 days'
)
ON CONFLICT (patient_id) DO UPDATE
SET
  name = EXCLUDED.name,
  age = EXCLUDED.age,
  gender = EXCLUDED.gender,
  allergies = EXCLUDED.allergies,
  conditions = EXCLUDED.conditions,
  medications = EXCLUDED.medications,
  recent_symptoms = EXCLUDED.recent_symptoms,
  last_visit = EXCLUDED.last_visit;
