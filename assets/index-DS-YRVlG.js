(function polyfill() {
  const relList = document.createElement("link").relList;
  if (relList && relList.supports && relList.supports("modulepreload")) {
    return;
  }
  for (const link of document.querySelectorAll('link[rel="modulepreload"]')) {
    processPreload(link);
  }
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") {
        continue;
      }
      for (const node of mutation.addedNodes) {
        if (node.tagName === "LINK" && node.rel === "modulepreload")
          processPreload(node);
      }
    }
  }).observe(document, { childList: true, subtree: true });
  function getFetchOpts(link) {
    const fetchOpts = {};
    if (link.integrity) fetchOpts.integrity = link.integrity;
    if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
    if (link.crossOrigin === "use-credentials")
      fetchOpts.credentials = "include";
    else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
    else fetchOpts.credentials = "same-origin";
    return fetchOpts;
  }
  function processPreload(link) {
    if (link.ep)
      return;
    link.ep = true;
    const fetchOpts = getFetchOpts(link);
    fetch(link.href, fetchOpts);
  }
})();
const ERROR_MESSAGE = {
  FETCH_ERROR: "API 서버 상태가 좋지 않아 데이터를 가져오는데 실패했습니다.",
  NO_DATA: "검색 값을 찾지 못했어요."
};
async function fetchUrl(url, queryObject, options = {}) {
  const queryString = new URLSearchParams(queryObject).toString();
  const finalUrl = queryString ? `${url}?${queryString}` : url;
  const response = await fetch(finalUrl, options);
  if (!response.ok || !navigator.onLine)
    throw new Error(ERROR_MESSAGE.FETCH_ERROR);
  return response.json() || [];
}
const URLS = {
  popularMovieUrl: "https://api.themoviedb.org/3/movie/popular",
  searchMovieUrl: "https://api.themoviedb.org/3/search/movie"
};
const defaultOptions = {
  headers: {
    Authorization: `Bearer ${"eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJiNDEwYjgwYTQ3YWZmMWY2N2Y3ZWI4YWRlNDdjNDMzZSIsIm5iZiI6MTc0MjA1NTc0OS44NDYwMDAyLCJzdWIiOiI2N2Q1YTk0NTMxNTM4ZGU2MDhmMTc5MjAiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.VeyCG6Y9nTOdCyVv3vzAUGIJj48idtO9l-c0vdcKBsU"}`
  }
};
const defaultQueryObject = {
  language: "ko-KR",
  include_adult: false
};
const TOTAL_PAGE = 500;
const Toast = {
  showToast(message, type = "error", duration = 5e3) {
    if (type === "info") duration = 2e3;
    let toastContainer = document.querySelector(".toast-container");
    if (!toastContainer) {
      toastContainer = document.createElement("div");
      toastContainer.className = "toast-container";
      document.body.appendChild(toastContainer);
    }
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    if (type == "error") message = message.replace("[ERROR]", "");
    toast.innerHTML = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.classList.add("show");
    }, 100);
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, duration);
    toast.addEventListener("click", () => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    });
  },
  resetToast() {
    let toastContainer = document.querySelector(".toast-container");
    if (toastContainer) toastContainer.remove();
  }
};
function createMovieLoader(url, queryObj, options, searchTerm) {
  let page = 1;
  return async () => {
    const queryObject = searchTerm ? { query: searchTerm, ...queryObj, page } : { ...queryObj, page };
    let response = null;
    try {
      response = await fetchUrl(url, queryObject, options);
    } catch (error) {
      Toast.showToast(error.message, "error", 5e3);
      return { results: [], isLastPage: true };
    }
    if (!response || !response.results)
      throw new Error(ERROR_MESSAGE.FETCH_ERROR);
    if (response.results.length === 0) throw new Error(ERROR_MESSAGE.NO_DATA);
    const { results, total_pages } = response;
    const pageLimit = Math.min(TOTAL_PAGE, total_pages);
    page++;
    return { results, isLastPage: page > pageLimit };
  };
}
function createElement(tag, props = {}) {
  const element = document.createElement(tag);
  Object.entries(props).forEach(([key, value]) => {
    if (key === "className") {
      if (Array.isArray(value)) {
        element.classList.add(...value);
      } else if (typeof value === "string") {
        element.classList.add(value);
      }
      return;
    }
    if (key in element) element[key] = value;
  });
  return element;
}
function createElementsFragment(elements) {
  const fragment = document.createDocumentFragment();
  fragment.append(...elements);
  return fragment;
}
const state = {
  loadMovies: null
};
function showElement(element) {
  element == null ? void 0 : element.classList.remove("hide");
}
function hideElement(element) {
  element == null ? void 0 : element.classList.add("hide");
}
function MovieItem({ src, title, rate }) {
  const $li = createElement("li");
  let url = `https://image.tmdb.org/t/p/w500/${src}`;
  if (!src) url = "images/fallback.png";
  $li.innerHTML = `
    <li>
        <div class="item">
            <img
            class="thumbnail"
            src='${url}'
            alt=${title}
            />
            <div class="item-desc">
            <p class="rate">
                <img src="./images/star_empty.png" class="star" />
                <span>${rate}</span>
            </p>
            <strong>${title}</strong>
            </div>
        </div>
    </li>
    `;
  return $li;
}
async function createMovieList(loadMovies, reset) {
  var _a;
  const skeleton = document.querySelector(".skeleton-list");
  showElement(skeleton);
  const { results, isLastPage } = await loadMovies();
  hideElement(skeleton);
  if (isLastPage) {
    (_a = document.getElementById("load-more")) == null ? void 0 : _a.classList.add("hide");
  }
  addMovies(results, reset);
}
function addMovies(results, reset) {
  const $list = document.getElementById("thumbnail-list");
  if (reset && $list) $list.innerHTML = "";
  const movieItems = results.map((result) => {
    const { title, poster_path, vote_average } = result;
    const movieItem = MovieItem({
      title,
      src: poster_path,
      rate: vote_average
    });
    return movieItem;
  });
  $list == null ? void 0 : $list.appendChild(createElementsFragment(movieItems));
}
async function handleSearch(searchValue) {
  updateSearchDescription(searchValue);
  prepareUIForSearch();
  try {
    state.loadMovies = createMovieLoader(
      URLS.searchMovieUrl,
      defaultQueryObject,
      defaultOptions,
      searchValue
    );
    await createMovieList(state.loadMovies, true);
    finalizeUISuccess();
  } catch (error) {
    handleSearchError(error);
  }
}
function updateSearchDescription(searchValue) {
  const description = document.getElementById("description");
  if (description) {
    description.textContent = `"${searchValue}" 검색 결과`;
  }
}
function prepareUIForSearch() {
  const $fallback = document.getElementById("fallback-div");
  const $hero = document.getElementById("hero");
  const $thumbnailList = document.getElementById("thumbnail-list");
  hideElement($fallback);
  hideElement($hero);
  hideElement($thumbnailList);
}
function finalizeUISuccess() {
  const $thumbnailContainer = document.getElementById("thumbnail-container");
  const $thumbnailList = document.getElementById("thumbnail-list");
  showElement($thumbnailContainer);
  showElement($thumbnailList);
}
function handleSearchError(error) {
  const $thumbnailContainer = document.getElementById("thumbnail-container");
  const $fallback = document.getElementById("fallback-div");
  if (error instanceof Error) {
    Toast.showToast(error.message, "error", 5e3);
  }
  hideElement($thumbnailContainer);
  showElement($fallback);
}
function Header() {
  const $headerContainer = createElement("div", {
    className: "header-container"
  });
  const $header = createElement("header", { className: "header" });
  const $logo = createElement("h1", { className: "logo" });
  const $logoImg = createElement("img", {
    src: "./images/logo.png",
    alt: "MovieList"
  });
  const $form = createElement("form", {
    className: "input-form"
  });
  const $searchButton = createElement("button", {
    className: "search-btn"
  });
  const $searchImg = createElement("img", {
    src: "./images/Search.png",
    alt: "돋보기"
  });
  const $input = createElement("input", {
    type: "text",
    name: "search-bar",
    className: "search-bar",
    placeholder: "검색어를 입력하세요"
  });
  $form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const searchValue = formData.get("search-bar");
    handleSearch(searchValue);
  });
  $logo.addEventListener("click", () => {
    location.reload();
  });
  $searchButton.appendChild($searchImg);
  $form.append($input, $searchButton);
  $logo.appendChild($logoImg);
  $header.append($logo, $form);
  $headerContainer.appendChild($header);
  return $headerContainer;
}
function Hero() {
  const backgroundHero = createElement("div", {
    id: "hero",
    className: "background-container"
  });
  backgroundHero.innerHTML = `

    <div class="overlay" aria-hidden="true" ></div>
       <div class="top-rated-container">
            <div class="top-rated-movie">
               <div class="rate">
                 <img src="./images/star_empty.png" class="star" />
                 <span class="rate-value">9.5</span>
               </div>
               <div class="title">인사이드 아웃2</div>
              <button class="primary detail">자세히 보기</button>
             </div>
  </div>
`;
  return backgroundHero;
}
function Button({ className, placeholder, onClick, id }) {
  const $button = createElement("button", { className, id });
  $button.textContent = placeholder;
  $button.addEventListener("click", onClick);
  return $button;
}
function init() {
  state.loadMovies = createMovieLoader(
    URLS.popularMovieUrl,
    defaultQueryObject,
    defaultOptions
  );
  setupHeaderAndHero();
  createMovieList(state.loadMovies);
  setupLoadMoreButton();
}
function setupHeaderAndHero() {
  const $wrap = document.getElementById("wrap");
  if ($wrap) {
    $wrap.prepend(Header());
    $wrap.prepend(Hero());
  }
}
function setupLoadMoreButton() {
  const $thumbnailContainer = document.getElementById("thumbnail-container");
  if ($thumbnailContainer) {
    const loadMoreButton = Button({
      className: ["primary", "width-100"],
      placeholder: "더보기",
      id: "load-more",
      onClick: () => createMovieList(state.loadMovies)
    });
    $thumbnailContainer.append(loadMoreButton);
  }
}
init();
