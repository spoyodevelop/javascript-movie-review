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
const Toast = {
  showToast(message, type = "error", duration = 5e3) {
    if (type === "info") duration = 2e3;
    let toastContainer = document.querySelector(
      ".toast-container"
    );
    if (!toastContainer) {
      toastContainer = document.createElement("div");
      toastContainer.className = "toast-container";
      document.body.appendChild(toastContainer);
    }
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    if (type === "error") {
      message = message.replace("[ERROR]", "");
    }
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
    const toastContainer = document.querySelector(
      ".toast-container"
    );
    if (toastContainer) toastContainer.remove();
  }
};
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
  include_adult: "false"
};
const TOTAL_PAGE = 500;
const paths = {
  logo: "./images/logo.png",
  search: "./images/Search.png",
  star_empty: "./images/star_empty.png"
};
function getPlainQuery(queryObj) {
  return queryObj instanceof URLSearchParams ? Object.fromEntries(queryObj.entries()) : queryObj;
}
function buildQuery(plainQuery, searchTerm, page) {
  return searchTerm ? { query: searchTerm, ...plainQuery, page: String(page) } : { ...plainQuery, page: String(page) };
}
const ERROR_MESSAGE = {
  FETCH_ERROR: "API 서버 상태가 좋지 않아 데이터를 가져오는데 실패했습니다.",
  NO_DATA: "검색 값을 찾지 못했어요.",
  SERVER_ERROR: "서버에서 오류가 발생했습니다. 관리자에게 문의하세요.",
  NETWORK_DISCONNECTED: "인터넷 연결이 끊어졌습니다. 연결을 확인해 주세요."
};
async function fetchUrl(url, queryObject, options = {}) {
  const queryString = new URLSearchParams(queryObject).toString();
  const finalUrl = queryString ? `${url}?${queryString}` : url;
  try {
    const response = await fetch(finalUrl, options);
    if (!response.ok) {
      throw new Error(ERROR_MESSAGE.SERVER_ERROR);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    if (!navigator.onLine) {
      throw new Error(ERROR_MESSAGE.NETWORK_DISCONNECTED);
    }
    throw new Error(ERROR_MESSAGE.FETCH_ERROR);
  }
}
function validateResponse(response) {
  if (!response || !response.results) {
    throw new Error(ERROR_MESSAGE.FETCH_ERROR);
  }
  if (response.results.length === 0) {
    throw new Error(ERROR_MESSAGE.NO_DATA);
  }
}
async function fetchMovies(url, queryObject, options, onError) {
  try {
    const response = await fetchUrl(
      url,
      new URLSearchParams(queryObject),
      options
    );
    validateResponse(response);
    return response;
  } catch (error) {
    if (onError) {
      onError(error);
    } else {
      throw error;
    }
    return { results: [], total_pages: 0, page: 1, total_results: 0 };
  }
}
function createMovieLoader(url, queryObj, options, onError, searchTerm) {
  let page = 1;
  return async () => {
    const plainQuery = getPlainQuery(queryObj);
    const queryObject = buildQuery(plainQuery, searchTerm, page);
    const response = await fetchMovies(url, queryObject, options, onError);
    const { results, total_pages } = response;
    const pageLimit = Math.min(TOTAL_PAGE, total_pages);
    page++;
    return { results, isLastPage: page > pageLimit };
  };
}
const state = {
  loadMovies: null
};
function createElement(tag, props = {}) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "className") {
      if (Array.isArray(value)) {
        element.classList.add(...value);
      } else if (typeof value === "string") {
        element.classList.add(value);
      }
      continue;
    }
    if (key in element) {
      element[key] = value;
    }
  }
  return element;
}
function createElementsFragment(elements) {
  const fragment = document.createDocumentFragment();
  fragment.append(...elements);
  return fragment;
}
async function handleSearch(searchValue) {
  setSearchResultTitle(searchValue);
  setSearchLoadingState();
  state.loadMovies = createMovieLoader(
    URLS.searchMovieUrl,
    defaultQueryObject,
    defaultOptions,
    (error) => handleSearchError(error),
    searchValue
  );
  await renderMovieList(state.loadMovies, true);
  displaySearchResults();
}
function setSearchResultTitle(searchValue) {
  const description = document.getElementById("description");
  if (description) {
    description.textContent = `"${searchValue}" 검색 결과`;
  }
}
function setSearchLoadingState() {
  const $fallback = document.getElementById("fallback");
  const $hero = document.getElementById("hero");
  const $thumbnailList = document.getElementById("thumbnail-list");
  hideElement($fallback);
  hideElement($hero);
  hideElement($thumbnailList);
}
function displaySearchResults() {
  const $thumbnailContainer = document.getElementById("thumbnail-container");
  const $thumbnailList = document.getElementById("thumbnail-list");
  showElement($thumbnailContainer);
  showElement($thumbnailList);
}
function handleSearchError(error) {
  const $thumbnailContainer = document.getElementById("thumbnail-container");
  const $fallback = document.getElementById("fallback");
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
    src: paths.logo,
    alt: "MovieList"
  });
  const $form = createElement("form", {
    className: "input-form"
  });
  const $searchButton = createElement("button", {
    className: "search-btn"
  });
  const $searchImg = createElement("img", {
    src: paths.search,
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
                 <img src="${paths.star_empty}" class="star" />
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
function MovieItem({ src, title, rate, onload }) {
  const $li = createElement("li");
  let url = `https://image.tmdb.org/t/p/w500/${src}`;
  if (!src) url = "images/fallback.png";
  $li.innerHTML = `
    <li>
      <div class="skeleton-thumbnail thumbnail"></div>
      <div class="item">
        <img
          class="thumbnail hide"
          src="${url}"
          alt="${title}"
        />
        <div class="item-desc">
          <p class="rate">
            <img src="./images/star_empty.png" class="star" />
            <span>${Number(rate).toFixed(1)}</span>
          </p>
          <strong>${title}</strong>
        </div>
      </div>
    </li>
  `;
  if (onload) {
    const img = $li.querySelector("img.thumbnail");
    img.addEventListener("load", onload);
  }
  return $li;
}
function showElement(element) {
  element == null ? void 0 : element.classList.remove("hide");
}
function hideElement(element) {
  element == null ? void 0 : element.classList.add("hide");
}
function hideImgSkeleton(event) {
  var _a, _b;
  const img = event.target;
  if (!img) return;
  showElement(img);
  const skeleton = (_b = (_a = img.parentElement) == null ? void 0 : _a.parentElement) == null ? void 0 : _b.querySelector(
    ".skeleton-thumbnail"
  );
  skeleton == null ? void 0 : skeleton.remove();
}
function renderMovieItems(results, reset) {
  const $list = document.getElementById("thumbnail-list");
  if (reset && $list) $list.innerHTML = "";
  const movieItems = results.map((result) => {
    const { title, poster_path, vote_average } = result;
    return MovieItem({
      title,
      src: poster_path,
      rate: vote_average,
      onload: hideImgSkeleton
    });
  });
  $list == null ? void 0 : $list.appendChild(createElementsFragment(movieItems));
}
async function handleMovieList(loadMovies, reset) {
  const skeleton = document.querySelector(".skeleton-list");
  const loadMore = document.getElementById("load-more");
  showElement(skeleton);
  hideElement(loadMore);
  const { results, isLastPage } = await loadMovies();
  showElement(loadMore);
  hideElement(skeleton);
  if (isLastPage) hideElement(loadMore);
  renderMovieItems(results, reset);
}
async function renderMovieList(loadMovies, reset) {
  await handleMovieList(loadMovies, reset);
}
function renderHeaderAndHero() {
  const $wrap = document.getElementById("wrap");
  if ($wrap) {
    $wrap.prepend(Header());
    $wrap.prepend(Hero());
  }
}
function renderLoadMoreButton(state2) {
  const $thumbnailContainer = document.getElementById("thumbnail-container");
  if ($thumbnailContainer) {
    const loadMoreButton = Button({
      className: ["primary", "width-100"],
      placeholder: "더보기",
      id: "load-more",
      onClick: () => renderMovieList(state2.loadMovies)
    });
    $thumbnailContainer.append(loadMoreButton);
  }
}
const initMovies = () => createMovieLoader(
  URLS.popularMovieUrl,
  defaultQueryObject,
  defaultOptions,
  (error) => Toast.showToast(error.message, "error", 5e3)
);
const initState = () => ({
  loadMovies: initMovies()
});
const renderApp = (state2) => {
  if (!state2.loadMovies) return;
  renderHeaderAndHero();
  renderMovieList(state2.loadMovies);
  renderLoadMoreButton(state2);
};
const main = () => {
  Object.assign(state, initState());
  renderApp(state);
};
main();
