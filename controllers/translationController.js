const { translateText, translateBatch } = require("../services/translationService");

const translateSingleText = async (req, res, next) => {
  try {
    const { text, targetLanguage, sourceLanguage } = req.validatedBody;
    const translatedText = await translateText(text, targetLanguage, sourceLanguage);

    return res.status(200).json({
      translatedText,
      targetLanguage
    });
  } catch (error) {
    error.statusCode = 502;
    return next(error);
  }
};

const translateBatchText = async (req, res, next) => {
  try {
    const { texts, targetLanguage, sourceLanguage } = req.validatedBody;
    const translatedTexts = await translateBatch(texts, targetLanguage, sourceLanguage);

    return res.status(200).json({
      translatedTexts,
      targetLanguage
    });
  } catch (error) {
    error.statusCode = 502;
    return next(error);
  }
};

module.exports = {
  translateSingleText,
  translateBatchText
};
