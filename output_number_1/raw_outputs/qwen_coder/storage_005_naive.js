const cacheAPIResponse = async (url) => {
  if (localStorage.getItem(url)) {
    return JSON.parse(localStorage.getItem(url));
  } else {
    const response = await fetch(url);
    const data = await response.json();
    localStorage.setItem(url, JSON.stringify(data));
    return data;
  }
};