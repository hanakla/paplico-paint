import { useFunk } from '@hanakla/arma'
import { nanoid } from 'nanoid'
import { memo, useState } from 'react'
import { keyframes } from 'styled-components'

const keyframe = keyframes`
  from {
    opacity: 0%;
  }

  to {
    opacity: 1000%;
  }
`

const enter = keyframes`
  /* from {
    transform: translateY(-100%);
  }
  to {
    transform: translateY(0);
  } */
`

const scaleLoop = keyframes`
  0% {
    transform: scale(1);
  }
  25% {
    transform: scale(1.05);
  }
  50% {
    transform: scale(1);
  }
  75% {
    transform: scale(0.95);
  }
  100% {
    transform: scale(1);
  }
`

export const PaplicoPreloader = memo(function PaplicoPreloader({
  width,
}: {
  width: number
}) {
  const [key, setKey] = useState(() => nanoid())

  const handleAnimationEnd = useFunk(() => {
    setTimeout(() => {
      setKey(nanoid())
    }, 150)
  })

  return (
    <svg
      css={`
        transform-origin: center;
        animation: ${scaleLoop} 2s infinite
          cubic-bezier(0.445, 0.05, 0.55, 0.95);
      `}
      viewBox="0 0 512 512"
      width={width}
    >
      <svg key={key} viewBox="0 0 512 512">
        <mask id="pplc-preload-mask">
          <rect x="0" y="0" width="512" height="512" fill="#fff" />

          <circle
            css={`
              opacity: 0%;
              animation: ${keyframe} 0.1s both;
              animation-delay: 0.3s;
            `}
            fill="black"
            cx="454.9"
            cy="218.05"
            r="156.39"
          />
          <circle
            css={`
              opacity: 0%;
              animation: ${keyframe} 0.1s both;
              animation-delay: 0.6s;
            `}
            fill="black"
            cx="229.64"
            cy="190.8"
            r="156.39"
          />
          <circle
            css={`
              opacity: 0%;
              animation: ${keyframe} 0.1s both;
              animation-delay: 0.9s;
            `}
            fill="black"
            cx="223.05"
            cy="355.61"
            r="156.39"
            onAnimationEnd={handleAnimationEnd}
          />
        </mask>

        <g
          css={`
            animation: ${enter} 0.1s both ease-in-out;
            mask: url(#pplc-preload-mask);
            transition-property: transform;
            transition-duration: 0.1s;
          `}
        >
          <path
            fill="rgba(254, 154, 196, 0.7)"
            d="M200.22,414.24c3.46,2.09,3.35,7.13-.18,9.11-17.55,9.85-66.62,13.67-75.27,6.22-12.04-10.38-19.27-61.48-10.41-108.76,.9-4.8,7.54-5.45,9.35-.92,10.2,25.49,31.24,66.98,76.5,94.35Z"
          />
          <path
            fill="rgba(254, 154, 196, 0.7)"
            d="M126.79,269.71c-1.91-32.17,42.3-183.3,71.96-195.37,54.61-22.22,243.88,141.4,234.53,192.78-5.91,32.47-113.77,98.62-197.26,138.86-36.63,2.37-107.32-104.1-109.22-136.27Z"
          />
        </g>
      </svg>
    </svg>
  )
})
