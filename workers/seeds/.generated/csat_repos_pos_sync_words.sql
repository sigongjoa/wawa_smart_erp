UPDATE vocab_words SET pos = (
  SELECT pos FROM vocab_catalog_words WHERE id = vocab_words.origin_catalog_word_id
) WHERE origin_catalog_word_id IS NOT NULL;
