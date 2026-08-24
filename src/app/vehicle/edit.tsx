import * as ImagePicker from 'expo-image-picker';
import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormInput } from '@/components/ui/FormInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { vehicleRepository } from '@/db/repositories';
import { useDatabaseStatus } from '@/hooks/useDatabaseStatus';
import type { Vehicle } from '@/models';
import { vehicleImageService } from '@/services/vehicleImageService';

interface VehicleForm {
  name: string;
  brand: string;
  model: string;
  registrationNumber: string;
  currentOdometer: string;
}

type FieldErrors = Partial<Record<keyof VehicleForm, string>>;

const emptyForm: VehicleForm = {
  name: '',
  brand: '',
  model: '',
  registrationNumber: '',
  currentOdometer: '',
};

function getErrorMessage(reason: unknown) {
  if (reason instanceof Error) {
    if (reason.message.includes('vehicles.registration_number')) {
      return 'That registration number is already assigned to another vehicle.';
    }

    return reason.message;
  }

  return 'The vehicle could not be saved. Please try again.';
}

export default function VehicleEditScreen() {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;
  const database = useDatabaseStatus();
  const [existingVehicle, setExistingVehicle] = useState<Vehicle | null>(null);
  const [form, setForm] = useState<VehicleForm>(emptyForm);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (database.state !== 'ready') {
      setLoading(database.state === 'initializing');
      return;
    }

    let active = true;

    void vehicleRepository.getPrimary().then(
      (vehicle) => {
        if (!active) {
          return;
        }

        setExistingVehicle(vehicle);
        setImageUri(vehicle?.imageUri ?? null);
        setForm(
          vehicle
            ? {
                name: vehicle.name,
                brand: vehicle.brand,
                model: vehicle.model,
                registrationNumber: vehicle.registrationNumber,
                currentOdometer: String(vehicle.currentOdometer),
              }
            : emptyForm,
        );
        setLoading(false);
      },
      (reason: unknown) => {
        if (active) {
          setFormError(getErrorMessage(reason));
          setLoading(false);
        }
      },
    );

    return () => {
      active = false;
    };
  }, [database.state]);

  function updateField(field: keyof VehicleForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  }

  function validateForm() {
    const errors: FieldErrors = {};

    if (!form.name.trim()) errors.name = 'Enter a vehicle name.';
    if (!form.brand.trim()) errors.brand = 'Enter the vehicle brand.';
    if (!form.model.trim()) errors.model = 'Enter the vehicle model.';
    if (!form.registrationNumber.trim()) {
      errors.registrationNumber = 'Enter the registration number.';
    }

    if (!existingVehicle) {
      if (!/^\d+$/.test(form.currentOdometer.trim())) {
        errors.currentOdometer = 'Enter a non-negative whole number.';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function selectImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Photo access needed',
        'Allow photo access in Android settings to select a vehicle image.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
      setFormError(null);
    }
  }

  async function saveVehicle() {
    if (!validateForm() || saving) {
      return;
    }

    setSaving(true);
    setFormError(null);

    const previousImageUri = existingVehicle?.imageUri ?? null;
    const imageChanged = imageUri !== previousImageUri;
    let newlyPersistedImage: string | null = null;
    let profileSaved = false;

    try {
      if (imageUri && imageChanged) {
        newlyPersistedImage = await vehicleImageService.persist(imageUri);
      }

      const storedImageUri = newlyPersistedImage ?? imageUri;
      const profile = {
        name: form.name,
        brand: form.brand,
        model: form.model,
        registrationNumber: form.registrationNumber,
        imageUri: storedImageUri,
      };

      if (existingVehicle) {
        await vehicleRepository.updateProfile(existingVehicle.id, profile);
      } else {
        await vehicleRepository.create({
          ...profile,
          currentOdometer: Number(form.currentOdometer),
        });
      }

      profileSaved = true;

      if (imageChanged && previousImageUri) {
        try {
          vehicleImageService.remove(previousImageUri);
        } catch {
          // A stale image is harmless and can be cleaned up in a later maintenance task.
        }
      }

      router.replace('/' as Href);
    } catch (reason: unknown) {
      if (newlyPersistedImage && !profileSaved) {
        try {
          vehicleImageService.remove(newlyPersistedImage);
        } catch {
          // Keep the original save error visible even if temporary-image cleanup fails.
        }
      }
      setFormError(getErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  if (loading || database.state === 'initializing') {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: colors.background }]} edges={['bottom']}>
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading vehicle profile…</Text>
      </SafeAreaView>
    );
  }

  if (database.state === 'error') {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: colors.background }]} edges={['bottom']}>
        <View style={styles.databaseError}>
          <Text style={[styles.errorTitle, { color: colors.text }]}>Local storage unavailable</Text>
          <Text style={[styles.errorDetail, { color: colors.danger }]}>{database.error}</Text>
          <PrimaryButton title="Try again" onPress={database.retry} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.screen}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.intro}>
            <Text style={[styles.title, { color: colors.text }]}>
              {existingVehicle ? 'Edit your vehicle' : 'Add your vehicle'}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {existingVehicle
                ? 'Keep the identifying details for this vehicle up to date.'
                : 'This information keeps maintenance and document reminders organized.'}
            </Text>
          </View>

          <View style={styles.imageSection}>
            <Pressable
              accessibilityRole="button"
              onPress={() => void selectImage()}
              style={[
                styles.imagePicker,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.vehicleImage} resizeMode="cover" />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Text style={styles.imageIcon}>🏍️</Text>
                  <Text style={[styles.imagePrompt, { color: colors.primary }]}>Choose a photo</Text>
                  <Text style={[styles.imageHint, { color: colors.textMuted }]}>Optional</Text>
                </View>
              )}
            </Pressable>
            {imageUri ? (
              <View style={styles.imageActions}>
                <Pressable accessibilityRole="button" onPress={() => void selectImage()}>
                  <Text style={[styles.imageAction, { color: colors.primary }]}>Change photo</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => setImageUri(null)}>
                  <Text style={[styles.imageAction, { color: colors.danger }]}>Remove</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          <View style={styles.fields}>
            <FormInput
              label="Vehicle name"
              placeholder="My Yamaha"
              value={form.name}
              error={fieldErrors.name}
              autoCapitalize="words"
              returnKeyType="next"
              onChangeText={(value) => updateField('name', value)}
            />
            <FormInput
              label="Brand"
              placeholder="Yamaha"
              value={form.brand}
              error={fieldErrors.brand}
              autoCapitalize="words"
              returnKeyType="next"
              onChangeText={(value) => updateField('brand', value)}
            />
            <FormInput
              label="Model"
              placeholder="FZ-S V4"
              value={form.model}
              error={fieldErrors.model}
              autoCapitalize="characters"
              returnKeyType="next"
              onChangeText={(value) => updateField('model', value)}
            />
            <FormInput
              label="Registration number"
              placeholder="ABC-1234"
              value={form.registrationNumber}
              error={fieldErrors.registrationNumber}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="next"
              onChangeText={(value) => updateField('registrationNumber', value)}
            />

            {existingVehicle ? (
              <View
                style={[
                  styles.odometerSummary,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View>
                  <Text style={[styles.odometerLabel, { color: colors.textMuted }]}>CURRENT ODOMETER</Text>
                  <Text style={[styles.odometerValue, { color: colors.text }]}>
                    {existingVehicle.currentOdometer.toLocaleString()} km
                  </Text>
                </View>
                <Text style={[styles.odometerHint, { color: colors.textMuted }]}>Mileage updates are recorded separately.</Text>
              </View>
            ) : (
              <FormInput
                label="Current odometer"
                placeholder="12450"
                value={form.currentOdometer}
                error={fieldErrors.currentOdometer}
                hint="Starting mileage in kilometres"
                keyboardType="number-pad"
                returnKeyType="done"
                onChangeText={(value) => updateField('currentOdometer', value)}
              />
            )}
          </View>

          {formError ? (
            <Text style={[styles.formError, { color: colors.danger }]}>{formError}</Text>
          ) : null}

          <View style={styles.actions}>
            <PrimaryButton
              title={existingVehicle ? 'Save changes' : 'Save vehicle'}
              loading={saving}
              disabled={database.state !== 'ready'}
              onPress={() => void saveVehicle()}
            />
            <PrimaryButton title="Cancel" variant="secondary" onPress={() => router.back()} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  loadingText: {
    fontSize: 15,
  },
  databaseError: {
    width: '100%',
    gap: Spacing.lg,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  errorDetail: {
    fontSize: 14,
    lineHeight: 20,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: 44,
    gap: Spacing.xl,
  },
  intro: {
    gap: Spacing.sm,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 23,
  },
  imageSection: {
    gap: Spacing.md,
  },
  imagePicker: {
    height: 190,
    overflow: 'hidden',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.lg,
  },
  vehicleImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  imageIcon: {
    marginBottom: Spacing.xs,
    fontSize: 36,
  },
  imagePrompt: {
    fontSize: 15,
    fontWeight: '700',
  },
  imageHint: {
    fontSize: 13,
  },
  imageActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xl,
  },
  imageAction: {
    fontSize: 14,
    fontWeight: '700',
  },
  fields: {
    gap: Spacing.lg,
  },
  odometerSummary: {
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  odometerLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  odometerValue: {
    marginTop: Spacing.xs,
    fontSize: 24,
    fontWeight: '800',
  },
  odometerHint: {
    fontSize: 13,
    lineHeight: 18,
  },
  formError: {
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    gap: Spacing.md,
  },
});
