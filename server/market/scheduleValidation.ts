export function validateCronExpression(value: string) {
  const fields = value.trim().split(/\s+/);
  if (fields.length !== 6) throw new Error("صيغة الجدول يجب أن تضم 6 حقول بتوقيت UTC.");
  if (fields[0] !== "0") throw new Error("يجب أن يكون حقل الثواني 0؛ لا يدعم النظام المسح دون الدقيقة.");
  return fields.join(" ");
}
