import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useState, useEffect } from 'react';
import { X } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useUpsertWorkout } from '@/hooks/useUpsertWorkout';
import { useSupabaseUser } from '@/hooks/useSupabaseUser';

const WORKOUT_BLOCKS = ['Upper', 'Lower', 'Push', 'Pull', 'Legs', 'Full Body', 'Rest'];

interface WorkoutEditorSheetProps {
  visible: boolean;
  dateISO: string;
  initial?: {
    id?: string;
    block?: string;
    notes?: string;
  };
  onClose: () => void;
}

export default function WorkoutEditorSheet({
  visible,
  dateISO,
  initial,
  onClose,
}: WorkoutEditorSheetProps) {
  const [selectedBlock, setSelectedBlock] = useState<string>(initial?.block || 'Upper');
  const [notes, setNotes] = useState<string>(initial?.notes || '');
  const [saving, setSaving] = useState(false);
  const upsertWorkout = useUpsertWorkout();
  const { user } = useSupabaseUser();

  useEffect(() => {
    if (visible) {
      setSelectedBlock(initial?.block || 'Upper');
      setNotes(initial?.notes || '');
    }
  }, [visible, initial]);

  const handleSave = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to save workouts');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        id: initial?.id,
        date: dateISO,
        block: selectedBlock,
        notes: notes || undefined,
        user_id: user.id,
      };

      const { error } = await upsertWorkout(payload);
      if (error) throw error;

      Alert.alert('Success', 'Workout saved!');
      onClose();
    } catch (error: any) {
      Alert.alert('Save Failed', error.message);
    } finally {
      setSaving(false);
    }
  };

  const formattedDate = new Date(dateISO).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="pageSheet">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Edit Workout</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.dateText}>{formattedDate}</Text>

            <Text style={styles.label}>Workout Type</Text>
            <View style={styles.blockGrid}>
              {WORKOUT_BLOCKS.map((block) => (
                <TouchableOpacity
                  key={block}
                  style={[
                    styles.blockPill,
                    selectedBlock === block && styles.blockPillSelected,
                  ]}
                  onPress={() => setSelectedBlock(block)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.blockPillText,
                      selectedBlock === block && styles.blockPillTextSelected,
                    ]}
                  >
                    {block}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Notes (Optional)</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add notes about your workout..."
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color={Colors.text} />
              ) : (
                <Text style={styles.saveButtonText}>Save Workout</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.primary,
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  blockGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  blockPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  blockPillSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  blockPillText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  blockPillTextSelected: {
    color: Colors.text,
  },
  notesInput: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 100,
    marginBottom: 20,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
});
