def should_transfer(intent_confidence: float | None, threshold: float) -> bool:
    if intent_confidence is None:
        return False
    return intent_confidence >= threshold
