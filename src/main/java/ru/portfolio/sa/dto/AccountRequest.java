package ru.portfolio.sa.dto;

import java.util.UUID;

public record AccountRequest(UUID requestId, String clientId, String personalAccount) {}
