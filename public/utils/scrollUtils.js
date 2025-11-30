function isUserNearBottom(container, threshold) {
  const scrollHeight = container.scrollHeight;
  const scrollTop = container.scrollTop;
  const clientHeight = container.clientHeight;
  return scrollHeight - scrollTop - clientHeight < threshold;
}

function scrollToBottom(container) {
  container.scrollTop = container.scrollHeight;
}

function scrollToBottomWithRetries(container, delays) {
  delays.forEach((delay) => {
    setTimeout(() => scrollToBottom(container), delay);
  });
}

function shouldAutoScroll(isNearBottom, isMyMessage) {
  return isNearBottom || isMyMessage;
}


