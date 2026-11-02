import { Input } from "@/components/ui/input";
import { COUNTRIES } from "@shared/countries";

/** Free-text country field with suggestions (names or ISO codes both work). */
export function CountryInput({ id, value, onChange, placeholder }: { id: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <>
      <Input id={id} list={`${id}-list`} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoComplete="off" />
      <datalist id={`${id}-list`}>
        {COUNTRIES.map(c => <option key={c.code} value={c.name} />)}
      </datalist>
    </>
  );
}
