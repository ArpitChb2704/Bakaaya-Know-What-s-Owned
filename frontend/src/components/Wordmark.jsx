export default function Wordmark({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-5xl md:text-6xl',
  }
  return (
    <span className={`font-display font-medium tracking-tight ${sizes[size]} ${className}`}>
      Bakaaya<span className="text-due">.</span>
    </span>
  )
}
