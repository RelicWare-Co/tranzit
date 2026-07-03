import {
  Alert,
  Badge,
  Box,
  Button,
  Group,
  Select,
  Stack,
  Switch,
  Tabs,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  FileCheck,
  FileText,
  FolderPlus,
  GripVertical,
  Link2,
  List,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  FormActionButton,
  FormActions,
  FormField,
  FormSection,
  PremiumModal,
} from "#/features/admin/components";
import { cx } from "#/shared/lib/cx";
import type { DocumentRequirement, FormFieldDef } from "./types";
import { generateId, generateSlugFromName, sanitizeSlug } from "./utils";

interface AddProcedureModalProps {
  opened: boolean;
  onClose: () => void;
  onCreate: (payload: {
    name: string;
    slug: string;
    description?: string;
    requiresVehicle: boolean;
    allowsPhysicalDocuments: boolean;
    instructions?: string;
    documentSchema?: Record<string, unknown>;
    formSchema?: Record<string, unknown>;
  }) => Promise<void>;
}

const TAB_FIELD_ORDER = [
  { tab: "general", fields: ["name", "slug", "description", "instructions"] },
  { tab: "requirements", fields: [] as string[] },
  { tab: "form", fields: [] as string[] },
] as const;

const FIELD_TYPE_OPTIONS: { value: FormFieldDef["type"]; label: string }[] = [
  { value: "text", label: "Texto" },
  { value: "number", label: "Número" },
  { value: "email", label: "Correo electrónico" },
  { value: "tel", label: "Teléfono" },
  { value: "select", label: "Selección" },
  { value: "textarea", label: "Área de texto" },
];

export function AddProcedureModal({
  opened,
  onClose,
  onCreate,
}: AddProcedureModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [, forceRender] = useState(0);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const slugInputRef = useRef<HTMLInputElement>(null);

  const form = useForm({
    mode: "uncontrolled",
    initialValues: {
      name: "",
      slug: "",
      description: "",
      requiresVehicle: false,
      allowsPhysicalDocuments: true,
      instructions: "",
      requirements: [] as DocumentRequirement[],
      formFields: [] as FormFieldDef[],
    },
    validate: {
      name: (value) => {
        const trimmed = value.trim();
        if (!trimmed) return "El nombre es obligatorio";
        if (trimmed.length < 3)
          return "El nombre debe tener al menos 3 caracteres";
        if (trimmed.length > 120)
          return "El nombre no puede exceder 120 caracteres";
        return null;
      },
      slug: (value) => {
        const trimmed = value.trim();
        if (!trimmed) return "El slug es obligatorio";
        if (trimmed.length < 2)
          return "El slug debe tener al menos 2 caracteres";
        if (trimmed.length > 60)
          return "El slug no puede exceder 60 caracteres";
        if (!/^[a-z0-9-]+$/.test(trimmed))
          return "Solo letras minúsculas, números y guiones";
        return null;
      },
      description: (value) => {
        if (value.trim().length > 500)
          return "La descripción no puede exceder 500 caracteres";
        return null;
      },
      instructions: (value) => {
        if (value.trim().length > 2000)
          return "Las instrucciones no pueden exceder 2000 caracteres";
        return null;
      },
    },
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset form when modal opens
  useEffect(() => {
    if (opened) {
      form.reset();
      setSubmitError(null);
      setSlugManuallyEdited(false);
      setActiveTab("general");
    }
  }, [opened]);

  const focusField = (field: string) => {
    requestAnimationFrame(() => {
      if (field === "name") {
        nameInputRef.current?.focus();
        return;
      }
      if (field === "slug") {
        slugInputRef.current?.focus();
        return;
      }
      const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        `[data-procedure-field="${field}"]`,
      );
      input?.focus();
    });
  };

  const handleInvalidSubmit = (errors: typeof form.errors) => {
    for (const { tab, fields } of TAB_FIELD_ORDER) {
      const firstField = fields.find((field) => errors[field]);
      if (firstField) {
        setActiveTab(tab);
        focusField(firstField);
        return;
      }
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const handleAddRequirement = () => {
    form.insertListItem("requirements", {
      id: generateId(),
      name: "",
      description: "",
      isRequired: true,
      downloadUrl: "",
      order: form.getValues().requirements.length,
    });
  };

  const handleRemoveRequirement = (index: number) => {
    form.removeListItem("requirements", index);
  };

  const handleAddFormField = () => {
    form.insertListItem("formFields", {
      id: generateId(),
      label: "",
      type: "text" as const,
      required: false,
      placeholder: "",
      options: [],
      order: form.getValues().formFields.length,
    });
  };

  const handleRemoveFormField = (index: number) => {
    form.removeListItem("formFields", index);
  };

  const handleAddOption = (fieldIndex: number) => {
    const current = form.getValues().formFields[fieldIndex].options ?? [];
    form.setFieldValue(`formFields.${fieldIndex}.options`, [...current, ""]);
  };

  const handleRemoveOption = (fieldIndex: number, optionIndex: number) => {
    const current = form.getValues().formFields[fieldIndex].options ?? [];
    form.setFieldValue(
      `formFields.${fieldIndex}.options`,
      current.filter((_, i) => i !== optionIndex),
    );
  };

  const handleSubmit = async (values: typeof form.values) => {
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const documentSchema = {
        requirements: values.requirements
          .filter((r) => r.name.trim())
          .map((r, i) => ({
            ...r,
            name: r.name.trim(),
            description: r.description?.trim() || undefined,
            downloadUrl: r.downloadUrl?.trim() || undefined,
            order: i,
          })),
      };

      const formSchemaPayload = {
        fields: values.formFields
          .filter((f) => f.label.trim())
          .map((f, i) => ({
            ...f,
            label: f.label.trim(),
            placeholder: f.placeholder?.trim() || undefined,
            options:
              f.type === "select"
                ? (f.options ?? []).filter((o) => o.trim())
                : undefined,
            order: i,
          })),
      };

      await onCreate({
        name: values.name.trim(),
        slug: values.slug.trim(),
        description: values.description.trim() || undefined,
        requiresVehicle: values.requiresVehicle,
        allowsPhysicalDocuments: values.allowsPhysicalDocuments,
        instructions: values.instructions.trim() || undefined,
        documentSchema,
        formSchema: formSchemaPayload,
      });
      form.reset();
      onClose();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo crear el trámite";
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const name = event.currentTarget.value;
    form.setFieldValue("name", name);
    if (!slugManuallyEdited) {
      form.setFieldValue("slug", generateSlugFromName(name));
    }
    forceRender((value) => value + 1);
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sanitized = sanitizeSlug(e.currentTarget.value);
    form.setFieldValue("slug", sanitized);
    setSlugManuallyEdited(true);
    forceRender((value) => value + 1);
  };

  const values = form.getValues();
  const nameInputProps = form.getInputProps("name");

  return (
    <PremiumModal
      opened={opened}
      onClose={handleClose}
      title="Nuevo trámite"
      subtitle="Configura un nuevo tipo de trámite para la agenda ciudadana"
      size="xl"
    >
      <form onSubmit={form.onSubmit(handleSubmit, handleInvalidSubmit)}>
        <Stack gap="lg">
          {submitError && (
            <Alert
              color="red"
              variant="light"
              radius="md"
              icon={<AlertCircle size={16} />}
            >
              {submitError}
            </Alert>
          )}

          <Tabs
            value={activeTab}
            onChange={(v) => setActiveTab(v ?? "general")}
            variant="outline"
            radius="lg"
          >
            <Tabs.List>
              <Tabs.Tab value="general" leftSection={<List size={14} />}>
                General
              </Tabs.Tab>
              <Tabs.Tab
                value="requirements"
                leftSection={<FileCheck size={14} />}
              >
                Requisitos{" "}
                <Badge size="xs" variant="light" ml={4}>
                  {values.requirements.length}
                </Badge>
              </Tabs.Tab>
              <Tabs.Tab value="form" leftSection={<ClipboardList size={14} />}>
                Formulario{" "}
                <Badge size="xs" variant="light" ml={4}>
                  {values.formFields.length}
                </Badge>
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="general" pt="lg">
              <Stack gap="lg">
                <FormSection
                  title="Información básica"
                  description="Datos identificativos del trámite"
                  icon={
                    <FolderPlus
                      size={18}
                      className="text-zinc-500"
                      strokeWidth={1.5}
                    />
                  }
                >
                  <Stack gap="md">
                    <FormField
                      label="Nombre del trámite"
                      error={form.errors.name}
                      helper="Ej: Renovación de Licencia de Conducción"
                      required
                    >
                      <TextInput
                        placeholder="Ingresa el nombre del trámite"
                        radius="md"
                        size="md"
                        disabled={isSubmitting}
                        key={form.key("name")}
                        ref={nameInputRef}
                        {...nameInputProps}
                        onChange={(event) => {
                          nameInputProps.onChange?.(event);
                          handleNameChange(event);
                        }}
                        data-procedure-field="name"
                        className={cx(
                          "transition-all duration-200",
                          form.getValues().name &&
                            !form.errors.name &&
                            "border-emerald-500/50",
                        )}
                      />
                    </FormField>

                    <FormField
                      label="Slug identificador"
                      error={form.errors.slug}
                      helper="Identificador único para URLs (se genera automáticamente desde el nombre)"
                      required
                    >
                      <div className="relative">
                        <TextInput
                          placeholder="renovacion-licencia"
                          radius="md"
                          size="md"
                          disabled={isSubmitting}
                          ref={slugInputRef}
                          value={values.slug}
                          onChange={handleSlugChange}
                          onBlur={() => form.validateField("slug")}
                          error={form.errors.slug}
                          data-procedure-field="slug"
                          leftSection={
                            <Link2 size={14} className="text-zinc-400" />
                          }
                          className={cx(
                            "transition-all duration-200",
                            values.slug &&
                              !form.errors.slug &&
                              "border-emerald-500/50",
                          )}
                          styles={{
                            input: {
                              fontFamily: "monospace",
                              fontSize: "0.875rem",
                          }}}
                        />
                      </div>
                      {slugManuallyEdited &&
                        values.name &&
                        !values.slug && (
                          <button
                            type="button"
                            onClick={() => {
                              form.setFieldValue(
                                "slug",
                                generateSlugFromName(values.name),
                              );
                              setSlugManuallyEdited(false);
                              forceRender((value) => value + 1);
                            }}
                            className="mt-1 text-xs text-zinc-500 hover:text-zinc-700 underline"
                          >
                            Restaurar slug automático
                          </button>
                        )}
                    </FormField>

                    <FormField
                      label="Descripción"
                      error={form.errors.description}
                      helper="Descripción opcional para ayudar a los ciudadanos a entender el trámite"
                    >
                      <Textarea
                        placeholder="Describe el propósito y requisitos del trámite..."
                        radius="md"
                        size="md"
                        minRows={3}
                        maxRows={5}
                        disabled={isSubmitting}
                        key={form.key("description")}
                        data-procedure-field="description"
                        {...form.getInputProps("description")}
                        className={cx(
                          "transition-all duration-200",
                          values.description &&
                            !form.errors.description &&
                            "border-emerald-500/50",
                        )}
                      />
                      <div className="flex justify-end">
                        <span
                          className={cx(
                            "text-xs transition-colors",
                            values.description.length > 450
                              ? "text-amber-600"
                              : "text-zinc-400",
                          )}
                        >
                          {values.description.length}/500
                        </span>
                      </div>
                    </FormField>
                  </Stack>
                </FormSection>

                <FormSection
                  title="Instrucciones para el ciudadano"
                  description="Indicaciones que verá el ciudadano antes de agendar"
                  icon={
                    <FileText
                      size={18}
                      className="text-zinc-500"
                      strokeWidth={1.5}
                    />
                  }
                >
                  <FormField
                    label="Instrucciones"
                    error={form.errors.instructions}
                    helper="Pasos, recomendaciones o información importante que el ciudadano debe conocer"
                  >
                    <Textarea
                      placeholder="1. Traer documento de identidad original..."
                      radius="md"
                      size="md"
                      minRows={4}
                      maxRows={8}
                      disabled={isSubmitting}
                      key={form.key("instructions")}
                      data-procedure-field="instructions"
                      {...form.getInputProps("instructions")}
                    />
                  </FormField>
                </FormSection>

                <FormSection
                  title="Configuración"
                  description="Opciones específicas del trámite"
                  icon={
                    <CheckCircle2
                      size={18}
                      className="text-zinc-500"
                      strokeWidth={1.5}
                    />
                  }
                >
                  <Stack gap="sm">
                    <div
                      className={cx(
                        "flex items-start gap-3 p-3 rounded-lg border transition-all duration-200",
                        values.requiresVehicle
                          ? "border-orange-200 bg-orange-50/30"
                          : "border-zinc-200 bg-zinc-50/50",
                      )}
                    >
                      <Switch
                        checked={values.requiresVehicle}
                        onChange={(e) =>
                          form.setFieldValue(
                            "requiresVehicle",
                            e.currentTarget.checked,
                          )
                        }
                        size="sm"
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-sm text-zinc-900">
                          Requiere vehículo
                        </div>
                        <div className="text-xs text-zinc-500 mt-0.5">
                          Este trámite involucra la revisión o registro de un vehículo
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-lg border border-emerald-200 bg-emerald-50/30">
                      <div className="flex-1">
                        <div className="font-medium text-sm text-zinc-900">
                          Requisitos físicos habilitados
                        </div>
                        <div className="text-xs text-zinc-500 mt-0.5">
                          Los ciudadanos deben llevar documentación y formatos impresos el día de la cita.
                        </div>
                      </div>
                    </div>
                  </Stack>
                </FormSection>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="requirements" pt="lg">
              <Stack gap="md">
                <Group justify="space-between" align="center">
                  <div>
                    <Text className="font-semibold text-zinc-900">
                      Requisitos documentales
                    </Text>
                    <Text size="sm" className="text-zinc-500">
                      Documentos que el ciudadano debe traer el día de la cita
                    </Text>
                  </div>
                  <Button
                    size="sm"
                    radius="md"
                    variant="light"
                    leftSection={<Plus size={14} />}
                    onClick={handleAddRequirement}
                    disabled={isSubmitting}
                  >
                    Agregar requisito
                  </Button>
                </Group>

                {values.requirements.length === 0 && (
                  <Box
                    p="xl"
                    className="text-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50"
                  >
                    <FileCheck
                      size={24}
                      className="text-zinc-400 mx-auto mb-2"
                      strokeWidth={1.5}
                    />
                    <Text size="sm" className="text-zinc-500">
                      No hay requisitos configurados. Agregá el primero.
                    </Text>
                  </Box>
                )}

                {values.requirements.map((req, index) => (
                  <Box
                    key={req.id}
                    className="rounded-xl border border-zinc-200 bg-white p-4 transition-all hover:border-zinc-300"
                  >
                    <Group gap="sm" align="flex-start" wrap="nowrap">
                      <Box className="mt-1 text-zinc-300">
                        <GripVertical size={16} />
                      </Box>
                      <Stack gap="sm" className="flex-1 min-w-0">
                        <Group gap="sm" wrap="nowrap">
                          <TextInput
                            placeholder="Nombre del requisito"
                            radius="md"
                            size="sm"
                            className="flex-1"
                            value={req.name}
                            onChange={(e) =>
                              form.setFieldValue(
                                `requirements.${index}.name`,
                                e.currentTarget.value,
                              )
                            }
                            disabled={isSubmitting}
                          />
                          <Switch
                            label="Obligatorio"
                            checked={req.isRequired}
                            onChange={(e) =>
                              form.setFieldValue(
                                `requirements.${index}.isRequired`,
                                e.currentTarget.checked,
                              )
                            }
                            size="sm"
                            disabled={isSubmitting}
                          />
                        </Group>
                        <Textarea
                          placeholder="Descripción o detalle del requisito (opcional)"
                          radius="md"
                          size="sm"
                          minRows={2}
                          maxRows={3}
                          value={req.description}
                          onChange={(e) =>
                            form.setFieldValue(
                              `requirements.${index}.description`,
                              e.currentTarget.value,
                            )
                          }
                          disabled={isSubmitting}
                        />
                        <TextInput
                          placeholder="URL de plantilla o archivo descargable (opcional)"
                          radius="md"
                          size="sm"
                          value={req.downloadUrl}
                          onChange={(e) =>
                            form.setFieldValue(
                              `requirements.${index}.downloadUrl`,
                              e.currentTarget.value,
                            )
                          }
                          disabled={isSubmitting}
                        />
                      </Stack>
                      <Button
                        variant="subtle"
                        color="red"
                        radius="md"
                        size="sm"
                        onClick={() => handleRemoveRequirement(index)}
                        disabled={isSubmitting}
                        className="mt-1"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </Group>
                  </Box>
                ))}
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="form" pt="lg">
              <Stack gap="md">
                <Group justify="space-between" align="center">
                  <div>
                    <Text className="font-semibold text-zinc-900">
                      Campos del formulario
                    </Text>
                    <Text size="sm" className="text-zinc-500">
                      Campos que el ciudadano completa al iniciar el trámite
                    </Text>
                  </div>
                  <Button
                    size="sm"
                    radius="md"
                    variant="light"
                    leftSection={<Plus size={14} />}
                    onClick={handleAddFormField}
                    disabled={isSubmitting}
                  >
                    Agregar campo
                  </Button>
                </Group>

                {values.formFields.length === 0 && (
                  <Box
                    p="xl"
                    className="text-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50"
                  >
                    <ClipboardList
                      size={24}
                      className="text-zinc-400 mx-auto mb-2"
                      strokeWidth={1.5}
                    />
                    <Text size="sm" className="text-zinc-500">
                      No hay campos configurados. Agregá el primero.
                    </Text>
                  </Box>
                )}

                {values.formFields.map((field, fieldIndex) => (
                  <Box
                    key={field.id}
                    className="rounded-xl border border-zinc-200 bg-white p-4 transition-all hover:border-zinc-300"
                  >
                    <Group gap="sm" align="flex-start" wrap="nowrap">
                      <Box className="mt-1 text-zinc-300">
                        <GripVertical size={16} />
                      </Box>
                      <Stack gap="sm" className="flex-1 min-w-0">
                        <Group gap="sm" wrap="nowrap">
                          <TextInput
                            placeholder="Etiqueta del campo"
                            radius="md"
                            size="sm"
                            className="flex-1"
                            value={field.label}
                            onChange={(e) =>
                              form.setFieldValue(
                                `formFields.${fieldIndex}.label`,
                                e.currentTarget.value,
                              )
                            }
                            disabled={isSubmitting}
                          />
                          <Select
                            value={field.type}
                            onChange={(v) =>
                              form.setFieldValue(
                                `formFields.${fieldIndex}.type`,
                                (v as FormFieldDef["type"]) ?? "text",
                              )
                            }
                            data={FIELD_TYPE_OPTIONS}
                            size="sm"
                            radius="md"
                            disabled={isSubmitting}
                            className="w-[160px]"
                          />
                          <Switch
                            label="Req."
                            checked={field.required}
                            onChange={(e) =>
                              form.setFieldValue(
                                `formFields.${fieldIndex}.required`,
                                e.currentTarget.checked,
                              )
                            }
                            size="sm"
                            disabled={isSubmitting}
                          />
                        </Group>
                        <TextInput
                          placeholder="Placeholder (opcional)"
                          radius="md"
                          size="sm"
                          value={field.placeholder}
                          onChange={(e) =>
                            form.setFieldValue(
                              `formFields.${fieldIndex}.placeholder`,
                              e.currentTarget.value,
                            )
                          }
                          disabled={isSubmitting}
                        />
                        {field.type === "select" && (
                          <Box className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-3">
                            <Text size="xs" className="font-semibold text-zinc-600 mb-2">
                              Opciones
                            </Text>
                            <Stack gap="xs">
                              {(field.options ?? []).map((option, optionIndex) => (
                                <Group key={optionIndex} gap="xs" wrap="nowrap">
                                  <TextInput
                                    placeholder={`Opción ${optionIndex + 1}`}
                                    radius="md"
                                    size="xs"
                                    className="flex-1"
                                    value={option}
                                    onChange={(e) => {
                                      const newOptions = [
                                        ...(field.options ?? []),
                                      ];
                                      newOptions[optionIndex] = e.currentTarget.value;
                                      form.setFieldValue(
                                        `formFields.${fieldIndex}.options`,
                                        newOptions,
                                      );
                                    }}
                                    disabled={isSubmitting}
                                  />
                                  <Button
                                    variant="subtle"
                                    color="gray"
                                    radius="md"
                                    size="sm"
                                    onClick={() =>
                                      handleRemoveOption(fieldIndex, optionIndex)
                                    }
                                    disabled={isSubmitting}
                                  >
                                    <X size={12} />
                                  </Button>
                                </Group>
                              ))}
                              <Button
                                size="xs"
                                radius="md"
                                variant="subtle"
                                leftSection={<Plus size={12} />}
                                onClick={() => handleAddOption(fieldIndex)}
                                disabled={isSubmitting}
                                className="w-fit"
                              >
                                Agregar opción
                              </Button>
                            </Stack>
                          </Box>
                        )}
                      </Stack>
                      <Button
                        variant="subtle"
                        color="red"
                        radius="md"
                        size="sm"
                        onClick={() => handleRemoveFormField(fieldIndex)}
                        disabled={isSubmitting}
                        className="mt-1"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </Group>
                  </Box>
                ))}
              </Stack>
            </Tabs.Panel>
          </Tabs>

          <FormActions align="right">
            <FormActionButton
              variant="secondary"
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancelar
            </FormActionButton>
            <FormActionButton
              variant="primary"
              type="submit"
              isLoading={isSubmitting}
              leftSection={<FileText size={16} strokeWidth={1.5} />}
            >
              Crear trámite
            </FormActionButton>
          </FormActions>
        </Stack>
      </form>
    </PremiumModal>
  );
}
