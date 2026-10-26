export function renderHome() {
  return `<section class="page-wrap home-welcome" aria-labelledby="home-title">
    <div class="home-copy">
      <p class="eyebrow">Curiosity looks good on you</p>
      <h1 class="page-title" id="home-title">Big ideas.<br>Clearer picture.</h1>
      <p class="lede">Index Dictionary is a visual, structured way to understand the ideas shaping everyday life.</p>
      <p class="home-detail">Explore a concept, see how it connects to other ideas, and learn at your own pace. Think of it as a map for curious minds—with fewer wrong turns and more “oh, that makes sense.”</p>
      <a class="button" href="#concepts" data-route="concepts">Explore a concept <span aria-hidden="true">→</span></a>
    </div>
    <div class="mascot-scene">
      <div class="mascot-halo" aria-hidden="true"></div>
      <div class="mascot" role="img" aria-label="A cheerful monkey mascot">🐒</div>
      <p class="mascot-bubble">“I came for one idea. Now I have twelve. Send snacks.”</p>
      <p class="mascot-caption">Your curiosity’s new co-pilot</p>
    </div>
  </section>`;
}
