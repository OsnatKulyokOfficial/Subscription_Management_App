export default function Footer({ dark }: { dark?: boolean }) {
  return (
    <p className={`text-center text-xs py-3 ${dark ? 'text-primary-200' : 'text-slate-400'}`}>
      כל הזכויות שמורות לאסנת קוליוק &nbsp;|&nbsp; 050-4796796
    </p>
  )
}
