# A small seeded random number generator (mulberry32), the same one the web game uses.
# The same seed gives the same numbers in TypeScript, Python and R, so every version gets the same
# daily challenge. R has no unsigned 32-bit integers, so these helpers keep 32-bit values as
# doubles between 0 and 2^32 and split them into 16-bit halves for the bit operations.

U32 <- 4294967296

u32 <- function(x) x %% U32

xor32 <- function(a, b) {
  bitwXor(as.integer(a %/% 65536), as.integer(b %/% 65536)) * 65536 +
    bitwXor(as.integer(a %% 65536), as.integer(b %% 65536))
}

or32 <- function(a, b) {
  bitwOr(as.integer(a %/% 65536), as.integer(b %/% 65536)) * 65536 +
    bitwOr(as.integer(a %% 65536), as.integer(b %% 65536))
}

and32 <- function(a, b) {
  bitwAnd(as.integer(a %/% 65536), as.integer(b %/% 65536)) * 65536 +
    bitwAnd(as.integer(a %% 65536), as.integer(b %% 65536))
}

# Multiplies two 32-bit numbers and keeps the low 32 bits, like Math.imul.
imul32 <- function(a, b) {
  ah <- a %/% 65536
  al <- a %% 65536
  bh <- b %/% 65536
  bl <- b %% 65536
  (((ah * bl + al * bh) %% 65536) * 65536 + al * bl) %% U32
}

shr32 <- function(a, k) a %/% (2^k)
shl32 <- function(a, k) (a * 2^k) %% U32

# Returns the next random number in [0, 1) and the generator's new state.
next_random <- function(state) {
  s <- u32(state + 0x6d2b79f5)
  t <- s
  t <- imul32(xor32(t, shr32(t, 15)), or32(t, 1))
  t <- xor32(t, u32(t + imul32(xor32(t, shr32(t, 7)), or32(t, 61))))
  list(value = xor32(t, shr32(t, 14)) / U32, state = s)
}

# Turns any text, such as a date, into a seed (32-bit FNV-1a over the character codes).
seed_from <- function(text) {
  h <- 2166136261
  for (code in utf8ToInt(text)) {
    h <- imul32(xor32(h, code), 16777619)
  }
  h
}

# A stream of random numbers from one seed, for code that draws many in a row.
rand_stream <- function(seed) {
  state <- u32(seed)
  function() {
    r <- next_random(state)
    state <<- r$state
    r$value
  }
}

below <- function(r, n) floor(r() * n)

# Numbers as plain digits, never in scientific notation.
num <- function(x) sprintf("%.0f", x)
