import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Dialog, HelperText, Portal, TextInput } from 'react-native-paper';

export interface PromptField {
  key: string;
  label: string;
  initial?: string;
  required?: boolean;
}

interface Props {
  visible: boolean;
  title: string;
  fields: PromptField[];
  confirmLabel: string;
  onDismiss: () => void;
  onSubmit: (values: Record<string, string>) => Promise<void>;
}

// Small form dialog: one or more text fields and a confirm button.
export const PromptDialog: React.FC<Props> = ({ visible, title, fields, confirmLabel, onDismiss, onSubmit }) => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setValues(Object.fromEntries(fields.map((f) => [f.key, f.initial ?? ''])));
      setError('');
    }
    // fields are defined inline by callers; reset only when the dialog opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const submit = async () => {
    const missing = fields.find((f) => f.required && !values[f.key]?.trim());
    if (missing) return setError(`${missing.label} is required.`);
    setBusy(true);
    try {
      await onSubmit(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()])));
      onDismiss();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Content style={styles.content}>
          {fields.map((f) => (
            <TextInput
              key={f.key}
              mode="outlined"
              label={f.label}
              value={values[f.key] ?? ''}
              onChangeText={(text) => setValues((v) => ({ ...v, [f.key]: text }))}
            />
          ))}
          <HelperText type="error" visible={!!error}>
            {error}
          </HelperText>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button mode="contained" onPress={submit} loading={busy} disabled={busy}>
            {confirmLabel}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  dialog: { maxWidth: 520, width: '92%', alignSelf: 'center' },
  content: { gap: 10 },
});
