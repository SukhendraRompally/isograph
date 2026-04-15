import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => (
    <div className="w-full">
      {label && (
        <label className="text-xs text-slate-400 block mb-1.5">{label}</label>
      )}
      <input
        ref={ref}
        {...props}
        className={`w-full bg-slate-800 border ${error ? 'border-red-500' : 'border-slate-700'} text-slate-100 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-indigo-500 placeholder:text-slate-600 ${className}`}
      />
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  )
)
Input.displayName = 'Input'
