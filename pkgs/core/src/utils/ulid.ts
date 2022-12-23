import { detectPrng, factory } from '@/thirdparty/ulid'

const prng = detectPrng(true)
export const ulid = factory(prng)
