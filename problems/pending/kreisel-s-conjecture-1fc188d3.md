---
id: null
name: "Kreisel's Conjecture"
status: open
area: [proof-theory]
impact: 1
canonical_reference:
  title: "Modern Perspectives in Proof Theory"
  author: "Aguilera  JP and Pakhomov F"
  venue: "Phil. Trans. R. Soc. A"
  year: 2024
  link: "https://royalsocietypublishing.org/rsta/article/381/2248/20220020/112343"
  doi: "https://doi.org/10.1098/rsta.2022.0020"
---

## Statement

Let $\mathsf{PA}$ be Peano Arithmetic in the language with function symbols for successor, plus, and times, which is axiomatized with the successor induction schema and identity axioms. Suppose that $\varphi(x)$ is a formula such that, for some $k\in\mathbb{N}$, $\varphi(\bar{n})$ has a
Gentzen-style proof of length $\leq k$ for each $n\in\mathbb{N}$. Does it follow that $\mathsf{PA}\vdash\forall x \varphi(x)$?

## Known Partial Results

The conjecture is true in the signature with function symbols for successor but ternary predicates for addition and multiplication (Parikh).

The conjecture is true in the signature with function symbols for successor and addition but a ternary predicate for multiplication (Miyatake).

The conjecture is false if the signature is enriched with a function symbol for subtraction (Hrubeš).

The conjecture is true if $\mathsf{PA}$ is axiomatized with the least-number principle instead of successor induction (Hrubeš).

## Additional References

Parikh, Rohit J. "Some results on the length of proofs." Transactions of the American Mathematical Society 177 (1973): 29-36.

Baaz, Matthias, and Pavel Pudlák. "Kreisel’s conjecture for L∃ 1." Arithmetic, proof theory and computational complexity (1993): 29-59.

Hrubeš, Pavel. "Theories very close to PA where Kreisel's Conjecture is false." The Journal of Symbolic Logic 72.1 (2007): 123-137.

Baaz, Matthias, and Piotr Wojtylak. "Generalizing proofs in monadic languages." Annals of Pure and Applied Logic 154.2 (2008): 71-138.

Hrubeš, Pavel. "Kreisel's Conjecture with minimality principle." The Journal of Symbolic Logic 74.3 (2009): 976-988.

Santos, Paulo Guilherme, and Reinhard Kahle. "Variants of Kreisel’s conjecture on a new notion of provability." Bulletin of Symbolic Logic 27.4 (2021): 337-350.
