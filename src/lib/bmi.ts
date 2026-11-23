export function bmi(weight: number | null | undefined, height: number | null | undefined): number | null {
  if (!weight || !height) return null;
  const h = Number(height) > 3 ? Number(height) / 100 : Number(height);
  return Math.round((Number(weight) / (h * h)) * 10) / 10;
}

export function bmiLabel(v: number): string {
  if (v < 18.5) return "Abaixo do peso";
  if (v < 25) return "Normal";
  if (v < 30) return "Sobrepeso";
  if (v < 35) return "Obesidade I";
  if (v < 40) return "Obesidade II";
  return "Obesidade III";
}
