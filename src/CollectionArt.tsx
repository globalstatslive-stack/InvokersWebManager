import { useId } from 'react'
import type { Equipment } from './memorypack'
import { slotLabel } from './labels'

// Ilustraciones vectoriales originales. No representan personajes concretos del juego.
export function PortraitArt({ titan = false }: { titan?: boolean }) {
  const id = useId()
  return <svg viewBox="0 0 300 240" role="img" aria-label={titan ? 'Ilustración genérica de Titán' : 'Ilustración genérica de Invoker'}>
    <defs><radialGradient id={`${id}-halo`}><stop stopColor={titan ? '#407b83' : '#636183'} stopOpacity=".7"/><stop offset="1" stopColor="#101723" stopOpacity="0"/></radialGradient><linearGradient id={`${id}-metal`} x2=".8" y2="1"><stop stopColor={titan ? '#8fbbbe' : '#d9c5a0'}/><stop offset=".45" stopColor={titan ? '#365d6a' : '#655e72'}/><stop offset="1" stopColor="#182637"/></linearGradient></defs>
    <rect width="300" height="240" fill="#111b29"/><ellipse cx="150" cy="118" rx="150" ry="138" fill={`url(#${id}-halo)`}/>
    <g fill="none" stroke={titan ? '#66b6b5' : '#d8b579'} opacity=".23"><circle cx="150" cy="119" r="89"/><circle cx="150" cy="119" r="79" strokeDasharray="2 9"/><path d="M150 17V39M150 202V226M48 119H70M230 119H252M79 48L94 63M206 175L222 191M79 191L94 175M206 63L222 48"/></g>
    {titan ? <g stroke="#78a6af" strokeWidth="1.4" strokeLinejoin="round"><path d="M40 239L57 163 93 132 102 81 80 34 130 65 153 50 178 67 228 29 205 91 211 131 247 164 264 239Z" fill={`url(#${id}-metal)`}/><path d="M102 81L132 96 153 76 178 99 205 91 194 143 170 174 132 173 109 142Z" fill="#213846"/><path d="M80 34L115 77 130 65M228 29L186 79 178 67M57 163L101 164 113 213 77 239M247 164L204 162 190 214 231 239M132 173L149 195 170 174" fill="none"/><path d="M115 111L139 118 133 125 117 120M166 117L189 108 187 120 171 125" fill="#9bf4df" stroke="none"/><path d="M134 143L150 131 168 143 156 157 145 157Z" fill="#101c2a"/><path d="M131 211L151 187 172 211 152 237Z" fill="#6ab6b1"/><path d="M151 187V237M131 211H172" stroke="#c0eee1"/></g> : <g stroke="#b0a18a" strokeWidth="1.2" strokeLinejoin="round"><path d="M57 240L72 169 113 147 107 109 116 69 149 47 182 68 194 110 184 147 227 169 245 240Z" fill={`url(#${id}-metal)`}/><path d="M116 69L148 84 182 68 172 120 150 143 125 122Z" fill="#182738"/><path d="M149 47L148 84 150 143M107 109L126 91M194 110L171 91M113 147L150 164 184 147 175 197 149 215 125 198Z" fill="none"/><path d="M122 102L140 108M158 108L177 101" stroke="#e8d7a4" strokeWidth="3"/><path d="M72 169L103 181 91 225 57 240M227 169L199 181 212 226 245 240" fill="#263346"/><path d="M150 164L160 180 150 197 140 180Z" fill="#d6b676"/><path d="M116 69L92 51 107 109M182 68L209 49 194 110" fill="#414655"/><path d="M104 234L149 215 197 235" fill="none"/></g>}
    <path d="M0 239H300" stroke="#70819a" opacity=".3"/>
  </svg>
}

const relicPaths: Record<number, string> = {
  1: 'M86 17L78 45 49 76 42 69 72 37Z M39 62L57 80 50 86 32 68Z M38 79L27 91 21 85 32 73Z',
  2: 'M60 16L91 29 86 67Q78 88 60 99Q42 88 34 67L29 29Z M60 27L79 36 75 64Q70 76 60 85Q50 76 45 64L41 36Z',
  3: 'M34 87L29 55 38 28 60 18 82 28 91 55 86 87 67 77 60 96 53 77Z M37 47L54 54 54 61 38 57Z M83 47L66 54 66 61 82 57Z',
  4: 'M12 61L28 33 49 25 60 44 71 25 92 33 108 61 86 79 69 69 60 55 51 69 34 79Z M25 50L44 40 47 57 33 66Z M95 50L76 40 73 57 87 66Z',
  5: 'M33 20L62 19 67 43 85 60 83 77 65 94 42 85 26 53Z M33 31L61 29 M30 47L64 44 M42 85L51 64 69 75 M51 64L63 55',
  6: 'M38 19L50 28 70 28 82 19 95 35 84 51 82 91 60 99 38 91 36 51 25 35Z M50 28L60 44 70 28 M38 62L60 72 82 62 M39 81L60 88 81 81',
  7: 'M15 42L45 35 75 35 105 42 105 74 75 81 45 81 15 74Z M44 32H76V84H44Z M53 45H67V70H53Z',
  8: 'M39 16H71L74 66 96 78 96 94 33 94 27 81 38 61Z M39 33H72 M38 50H73 M38 72L62 80 M33 87H96',
}
const accessoryPaths: Record<number, string> = {
  1: 'M35 19Q17 54 48 66 M85 19Q103 54 72 66 M60 53L78 72 60 98 42 72Z M60 63L69 74 60 87 51 74Z',
  2: 'M36 22A10 10 0 1 0 36 42A10 10 0 1 0 36 22 M84 22A10 10 0 1 0 84 42A10 10 0 1 0 84 22 M36 46L51 67 36 94 21 67Z M84 46L99 67 84 94 69 67Z',
  3: 'M28 16V103 M28 24H91L80 48 91 73H28 M45 37L64 28 78 46 63 63 45 54Z',
  4: 'M60 16L75 35 96 40 88 62 92 82 70 88 60 103 48 87 26 82 32 61 23 40 46 35Z M60 37L77 58 60 80 43 58Z',
  5: 'M45 17H75V34L89 57 88 89 77 99H43L32 89 31 57 45 34Z M40 63H80L79 85 71 91H49L41 85Z M43 23H77',
}
export function EquipmentArt({ item }: { item: Equipment }) {
  const id = useId()
  const path = (item.kind === 'relic' ? relicPaths : accessoryPaths)[item.slot]
  return <svg viewBox="0 0 120 120" role="img" aria-label={`Ilustración de ${slotLabel(item).toLowerCase()}`}>
    <defs><linearGradient id={id} x2=".8" y2="1"><stop stopColor="#f4e4bd"/><stop offset=".4" stopColor="#b8a077"/><stop offset="1" stopColor="#394c65"/></linearGradient></defs>
    <circle cx="60" cy="60" r="49" fill="none" stroke="currentColor" opacity=".16"/><circle cx="60" cy="60" r="41" fill="currentColor" opacity=".05"/>
    <path d={path ?? 'M60 20L96 60 60 100 24 60Z'} fill={`url(#${id})`} stroke="#f0dbb0" strokeWidth="1.5" strokeLinejoin="round" fillRule="evenodd"/>
    <path d="M60 7V13M60 107V113M7 60H13M107 60H113" stroke="currentColor" opacity=".5"/>
  </svg>
}
