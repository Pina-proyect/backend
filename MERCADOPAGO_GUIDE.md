# Guía de Integración de Pagos: Pina Digital

Este documento detalla el funcionamiento técnico y financiero de la pasarela de pagos integrada en Pina durante el Sprint 4.

## 1. Flujo de Pago y Comisiones

El modelo de negocio de Pina se basa en una comisión por servicio del **7%** sobre el valor de cada pack o donación vendido por las creadoras.

### Distribución del Dinero
Cuando un usuario compra un pack de, por ejemplo, **$1000**:
1.  **MercadoPago** deduce su comisión estándar (depende del medio de pago, ej: 3.5% + IVA).
2.  **Pina** retiene un **7%** ($70) como comisión de plataforma.
3.  El **Creador** recibe el remanente (aprox. $895 después de todas las deducciones).

### Diferencia de Modelos:
- **Centralizado (MVP)**: Todos los pagos entran a la cuenta de Pina. Nosotros llevamos el registro de "Saldo a Favor" de la creadora en la base de datos.
- **Marketplace (Futuro)**: El dinero se divide en el momento de la transacción y llega directamente a la cuenta de la creadora y la de Pina por separado.

## 2. Configuración de Credenciales

Necesitaremos dos claves principales en el archivo `.env` del Backend:
- `MP_ACCESS_TOKEN`: Para autenticar las peticiones a la API de MercadoPago.
- `MP_WEBHOOK_SECRET`: Para validar que las notificaciones de pago que recibimos son realmente de MercadoPago y no de un atacante.

## 3. El Ciclo de Vida de una Transacción

1.  **Preferencia**: El cliente hace clic en "Comprar". El backend crea una `Preference` en MP con el ID del Pack y el ID del Usuario en el campo `external_reference`.
2.  **Checkout**: El usuario paga en la interfaz de MercadoPago.
3.  **Webhook (Notificación)**: MercadoPago envía un POST a `/api/pina/payments/webhook`.
4.  **Validación**: El servidor consulta el estado del pago a MercadoPago usando el ID recibido.
5.  **Liberación**: Si el estado es `approved`, el servidor inserta un registro en la tabla `Access` y el contenido se desbloquea (Blur OFF) para ese usuario.

## 4. Seguridad de Webhooks

Para evitar accesos fraudulentos, el endpoint de Webhook:
- **No es público**: Solo acepta peticiones validadas.
- **Doble Check**: Nunca confiamos solo en lo que dice el Webhook. El servidor siempre hace una consulta secundaria a la API oficial de MercadoPago para confirmar el estado del pago antes de liberar el contenido.

---
> [!IMPORTANT]
> Recuerda que para probar esto en local, el servidor de NestJS debe estar "visible" para MercadoPago. Usaremos **ngrok** para mapear nuestro puerto 4000 a una URL pública.
