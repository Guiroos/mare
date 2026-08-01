/**
 * Retorno tipado para falhas esperadas de negócio em Server Actions.
 *
 * `Error` lançado por uma Server Action é mascarado pelo React em build de
 * produção (a mensagem original nunca chega ao cliente) — reservar `throw`
 * para o excepcional e devolver `ActionResult` para toda falha que o
 * usuário pode causar e precisa entender.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string }
