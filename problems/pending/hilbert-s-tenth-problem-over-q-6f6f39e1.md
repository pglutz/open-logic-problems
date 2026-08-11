---
id: null
name: "Hilbert's Tenth Problem over Q"
status: open
area: [computability-theory, model-theory]
impact: 3
canonical_reference:
  key: "Poo03"
  title: "Hilbert's tenth problem and Mazur's conjecture for large subrings of Q"
  author: "Bjorn Poonen"
  venue: "Journal of the American Mathematical Society"
  year: 2003
  doi: "10.1090/S0894-0347-03-00433-8"
references:
  - key: "ABHS26"
    title: "Rank stability in quadratic extensions and Hilbert’s tenth problem for the ring of integers of a number field"
    author: "Levent Alpöge, Manjul Bhargava, Wei Ho, and Ari Shnidman"
    venue: "Inventiones Mathematicae"
    year: 2026
    doi: "10.1007/s00222-025-01392-3"
  - key: "Mat70"
    title: "The Diophantineness of enumerable sets"
    author: "Yuri Matiyasevich"
    venue: "Doklady Akademii Nauk SSSR"
    year: 1970
  - key: "DPR61"
    title: "The decision problem for exponential diophantine equations"
    author: "Davis, Martin and Putnam, Hilary and Robinson, Julia"
    venue: "Annals of Mathematics"
    year: 1961
    doi: "10.2307/1970289"
---

## Statement

Is the following problem decidable? Given a polynomial $p \in \mathbb{Q}[x_1, \ldots, x_n]$, determine whether $p$ has a rational root, i.e. a tuple $(a_1, \ldots, a_n) \in \mathbb{Q}$ such that $p(a_1, \ldots, a_n) = 0$.

## Known Partial Results

Hilbert's 10th problem was to find a procedure which, given any polynomial $p \in \mathbb{Z}[x_1,\ldots,x_n]$, would decide if $p$ has an integral root, i.e. a tuple $(a_1, \ldots, a_n) \in \mathbb{Z}$ such that $p(a_1, \ldots, a_n) = 0$. However, the MRDP (Matiyasevich, Robinson, Davis, and Putnam) Theorem states that there is no such computable procedure.

Given any countable ring $R$ with a computable presentation, one can ask a version of Hilbert's 10th problem over $R$. Namely, is the following problem decidable: given a polynomial $p \in R[x_1, \ldots, x_n]$, determine whether $p$ has a root in $R$? The answer to this question is known for several rings and open for others:
- For $R = \overline{\mathbb{Q}}$, the algebraic closure of the rationals, the answer is yes, i.e. the problem is decidable. This follows from quantifier elimination for algebraically closed fields.
- As stated above, for $R = \mathbb{Z}$ the answer is no. This was proved by Matiyasevich [^Mat70], building on work by Davis, Putnam and Robinson [^DPR61]. 
- Alpöge, Bhargava, Ho, and Shnidman [^ABHS26] proved that if $R$ is the ring of integers of any number field then the answer is no.

## Notes

This question is known to be equivalent to the question of whether there is a decision procedure for the problem of determining whether a variety over $\mathbb{Q}$ has a rational point.

To give a negative answer to the question, it is enough to show that $\mathbb{Z}$ is diophantine over $\mathbb{Q}$, i.e. that there is a polynomial $p(x, y_1, \ldots, y_n)$ over $\mathbb{Q}$ such that $a \in \mathbb{Q}$ is in $\mathbb{Z}$ if and only if $p(a, y_1, \ldots, y_n)$ has a rational root.


<!-- opl-notify:w6Wt9dt4AQCx4AJFlTNczC7qKoShjWGScwcwdeTLYbMRanGBNo+GLPmxKAHM8FxSPtt0u0qX3RZfRMtSIAzHjMM8DF5/NAtfq16QfbTf5HkaIAN2Esfcau+zI4WDShxr3eZBsPcSZXPLSeqi285dMTbpwS2c1KSVbyPQN4kIPL+1/QlZYJqhYWU= -->
