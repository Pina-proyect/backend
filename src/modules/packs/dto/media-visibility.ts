import { registerDecorator, ValidationOptions } from 'class-validator';

/** Valores admitidos de visibilidad de media en contexto de pack. */
export const MEDIA_VISIBILITIES = ['preview', 'exclusive'] as const;
export type MediaVisibility = (typeof MEDIA_VISIBILITIES)[number];

/**
 * `true` si el valor es un mapa `Record<mediaId, 'preview' | 'exclusive'>`
 * válido (objeto no nulo, no array, con valores dentro del dominio).
 */
export function isValidMediaVisibility(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every((v) =>
    (MEDIA_VISIBILITIES as readonly unknown[]).includes(v),
  );
}

/**
 * Valida un mapa de visibilidad por media (REQ-SVD-3, D3). Aditivo y opcional:
 * solo valida los valores; la pertenencia de cada media se comprueba en el
 * service.
 */
export function IsMediaVisibility(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isMediaVisibility',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: (value: unknown) => isValidMediaVisibility(value),
      },
    });
  };
}
