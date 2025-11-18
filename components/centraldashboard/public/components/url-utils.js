/**
 * @fileoverview Utility functions for dynamic URL generation based on tenant.
 *
 * OVERVIEW:
 * This module provides tenant-aware URL generation for multi-tenant
 * Kubeflow deployments.
 * It automatically detects the current tenant from the hostname and
 * generates appropriate
 * URLs for external services.
 *
 * FLOW:
 * 1. main-page.js calls getCurrentTenant() on initialization
 * 2. getCurrentTenant() extracts tenant from window.location.hostname
 * 3. When dashboard links are loaded, processExternalLinks() updates
 *    URLs with tenant info
 * 4. Individual service URLs can be generated using generateServiceUrl()
 *
 * TENANT EXAMPLES:
 * - Hostname: "ramsay.cloud-tmp.physicsx.ai" -> Tenant: "ramsay"
 * - Hostname: "demo-dev.cloud-tmp.physicsx.ai" -> Tenant: "demo-dev"

 *
 * INTEGRATION POINTS:
 * - main-page.js: _initializeTenantAndDomain(),
 *   _onDashboardLinksResponse(), _getDocumentationUrl()
 * - External API: Dashboard configuration endpoint provides base URLs
 *   with placeholders
 */

/**
 * Configuration for external services
 * This defines how URLs are generated for each service type
 *
 * URL Generation Examples:
 * For tenant "ramsay":
 * - MLFLOW: https://ramsay-mlflow.cloud-tmp.physicsx.ai/
 * - OPTIMIZER: https://ramsay.cloud-tmp.physicsx.ai/platform-app/app/optimizer
 * - VAULT: https://ramsay.cloud-tmp.physicsx.ai/vault-filebrowser/files/
 * - SIM_WORKBENCH: https://ramsay.cloud-tmp.physicsx.ai/simlab-react-ui/projects
 *
 * For tenant "demo-dev":
 * - MLFLOW: https://demo-dev-mlflow.cloud-tmp.physicsx.ai/
 * - OPTIMIZER: https://demo-dev.cloud-tmp.physicsx.ai/platform-app/app/optimizer
 * - VAULT: https://demo-dev.cloud-tmp.physicsx.ai/vault-filebrowser/files/
 * - SIM_WORKBENCH: https://demo-dev.cloud-tmp.physicsx.ai/simlab-react-ui/projects
 */
const SERVICE_CONFIG = {
    MLFLOW: {
        name: 'mlflow',
        format: 'tenant-prefix', // Uses TENANT-mlflow format
        path: '/',
        // Generates: https://ramsay-mlflow.cloud-tmp.physicsx.ai/
        // Generates: https://demo-dev-mlflow.cloud-tmp.physicsx.ai/
    },
    OPTIMIZER: {
        name: 'optimizer',
        format: 'tenant-subdomain', // Uses TENANT.domain format
        path: '/platform-app/app/optimizer',
        // Generates: https://ramsay.cloud-tmp.physicsx.ai/platform-app/app/optimizer
        // Generates: https://demo-dev.cloud-tmp.physicsx.ai/platform-app/app/optimizer
    },
    VAULT: {
        name: 'vault',
        format: 'tenant-subdomain',
        path: '/vault-filebrowser/files/',
        // Generates: https://ramsay.cloud-tmp.physicsx.ai/vault-filebrowser/files/
        // Generates: https://demo-dev.cloud-tmp.physicsx.ai/vault-filebrowser/files/
    },
    SIM_WORKBENCH: {
        name: 'sim-workbench',
        format: 'tenant-subdomain',
        path: '/simlab-react-ui/projects',
        // Generates: https://ramsay.cloud-tmp.physicsx.ai/simlab-react-ui/projects
        // Generates: https://demo-dev.cloud-tmp.physicsx.ai/simlab-react-ui/projects
    },
    PLATFORM_DOCS: {
        name: 'platform-docs',
        format: 'tenant-subdomain',
        path: '/documentation/',
        // Generates: https://ramsay.cloud-tmp.physicsx.ai/documentation/
        // Generates: https://demo-dev.cloud-tmp.physicsx.ai/documentation/
    },
    AI_WORKBENCH_DOCS: {
        name: 'ai-workbench',
        format: 'tenant-subdomain',
        path: '/platform-documentation/ai_workbench/index.html',
        // Generates: https://ramsay.cloud-tmp.physicsx.ai/documentation/ai_workbench/index.html
        // Generates: https://demo-dev.cloud-tmp.physicsx.ai/documentation/ai_workbench/index.html
    },
};

/**
 * Default domain configuration
 */
const DEFAULT_DOMAIN = 'cloud-tmp.physicsx.ai';

/**
 * Extract tenant name from hostname
 * This function extracts the tenant from the first part of the hostname
 *
 * Examples:
 * - "ramsay.cloud-tmp.physicsx.ai" -> extracts "ramsay"
 * - "demo-dev.cloud-tmp.physicsx.ai" -> extracts "demo-dev"
 * - "ramsay-kubeflow.cloud-tmp.physicsx.ai" -> extracts "ramsay"
 * - "demo-dev-kubeflow.cloud-tmp.physicsx.ai" -> extracts "demo-dev"
 *
 * @param {string} hostname - The hostname to parse
 * @return {string|null} The extracted tenant name or null if invalid
 */
export function extractTenantFromHostname(hostname) {
    if (!hostname || typeof hostname !== 'string') {
        return null;
    }

    // Split hostname by dots and take the first part as tenant
    // This handles multi-part tenant names like "demo-dev" or "ramsay"
    const parts = hostname.split('.');
    if (parts.length < 2) {
        return null;
    }

    let tenant = parts[0]; // First part is the tenant
    const domain = parts.slice(1).join('.'); // Rest is the domain

    // Validate that we have both tenant and domain
    if (!tenant || !domain) {
        return null;
    }

    // Extract everything before "-kubeflow" if present
    // (e.g., "demo-dev-kubeflow" -> "demo-dev")
    // This handles cases where the dashboard runs on hostname like
    // "demo-dev-kubeflow.cloud-tmp.physicsx.ai" but we want tenant "demo-dev"
    const kubeflowIndex = tenant.indexOf('-kubeflow');
    if (kubeflowIndex !== -1) {
        tenant = tenant.substring(0, kubeflowIndex);
    }

    return tenant;
}

/**
 * Get the current domain from hostname
 *
 * @param {string} hostname - The hostname to parse
 * @return {string} The domain part of the hostname
 */
export function extractDomainFromHostname(hostname) {
    if (!hostname || typeof hostname !== 'string') {
        return DEFAULT_DOMAIN;
    }

    // Extract domain part after the first dot
    const dotIndex = hostname.indexOf('.');
    if (dotIndex === -1) {
        return DEFAULT_DOMAIN;
    }

    return hostname.substring(dotIndex + 1);
}

/**
 * Generate URL for a specific service based on tenant
 * This is the core function that creates tenant-specific URLs
 *
 * URL Generation Logic:
 * 1. tenant-prefix format: https://TENANT-SERVICE.domain/path
 *    - Used for MLflow: "ramsay" -> https://ramsay-mlflow.cloud-tmp.physicsx.ai/
 *    - Used for MLflow: "demo-dev" -> https://demo-dev-mlflow.cloud-tmp.physicsx.ai/
 *
 * 2. tenant-subdomain format: https://TENANT.domain/path
 *    - Used for Optimizer: "ramsay" -> https://ramsay.cloud-tmp.physicsx.ai/platform-app/app/optimizer
 *    - Used for Optimizer: "demo-dev" -> https://demo-dev.cloud-tmp.physicsx.ai/platform-app/app/optimizer
 *    - Used for Vault: "ramsay" -> https://ramsay.cloud-tmp.physicsx.ai/vault-filebrowser/files/
 *    - Used for Vault: "demo-dev" -> https://demo-dev.cloud-tmp.physicsx.ai/vault-filebrowser/files/
 *
 * @param {string} serviceName - The service name (MLFLOW, OPTIMIZER, etc.)
 * @param {string} tenant - The tenant name (ramsay, demo-dev, etc.)
 * @param {string} domain - The domain (optional, defaults to extracted domain)
 * @return {string|null} The generated URL or null if invalid
 */
export function generateServiceUrl(serviceName, tenant, domain = null) {
    if (!tenant || !serviceName) {
        return null;
    }

    const serviceConfig = SERVICE_CONFIG[serviceName.toUpperCase()];
    if (!serviceConfig) {
        // eslint-disable-next-line no-console
        console.warn(`Unknown service: ${serviceName}`);
        return null;
    }

    // Use provided domain or extract from current hostname
    const targetDomain = domain ||
        extractDomainFromHostname(window.location.hostname);

    let url;
    if (serviceConfig.format === 'tenant-prefix') {
        // Format: https://TENANT-SERVICE.domain/path
        // Example: ramsay + mlflow -> https://ramsay-mlflow.cloud-tmp.physicsx.ai/
        // Example: demo-dev + mlflow -> https://demo-dev-mlflow.cloud-tmp.physicsx.ai/
        url = `https://${tenant}-${serviceConfig.name}.${targetDomain}${serviceConfig.path}`;
    } else if (serviceConfig.format === 'tenant-subdomain') {
        // Format: https://TENANT.domain/path
        // Example: ramsay -> https://ramsay.cloud-tmp.physicsx.ai/platform-app/app/optimizer
        // Example: demo-dev ->
        //   https://demo-dev.cloud-tmp.physicsx.ai/platform-app/app/optimizer
        url = `https://${tenant}.${targetDomain}${serviceConfig.path}`;
    } else {
        // eslint-disable-next-line no-console
        console.warn(`Unknown service format: ${serviceConfig.format}`);
        return null;
    }

    return url;
}

/**
 * Generate all service URLs for a given tenant
 *
 * @param {string} tenant - The tenant name
 * @param {string} domain - The domain (optional)
 * @return {Object} Object containing all service URLs
 */
export function generateAllServiceUrls(tenant, domain = null) {
    const urls = {};

    Object.keys(SERVICE_CONFIG).forEach((serviceKey) => {
        const serviceName = SERVICE_CONFIG[serviceKey].name;
        urls[serviceName] = generateServiceUrl(serviceKey, tenant, domain);
    });

    return urls;
}

/**
 * Get the current tenant from window.location.hostname
 *
 * @return {string|null} The current tenant or null if invalid
 */
export function getCurrentTenant() {
    const hostname = window.location.hostname;
    const tenant = extractTenantFromHostname(hostname);

    return tenant;
}

/**
 * Get the current domain from window.location.hostname
 *
 * @return {string} The current domain
 */
export function getCurrentDomain() {
    return extractDomainFromHostname(window.location.hostname);
}

/**
 * Process external link URLs by replacing placeholders
 *
 * @param {string} link - The link URL that may contain placeholders
 * @param {string} tenant - The tenant name
 * @param {string} domain - The domain (optional)
 * @return {string} The processed link with placeholders replaced
 */
export function processExternalLink(link, tenant, domain = null) {
    if (!link || !tenant) {
        return link;
    }

    const targetDomain = domain || getCurrentDomain();

    // Replace placeholders in the link
    return link
        .replace(/\$\{TENANT\}/g, tenant)
        .replace(/\$\{DOMAIN\}/g, targetDomain);
}

/**
 * Process an array of external links by replacing placeholders
 * This function is used in main-page.js to process the externalLinks array
 * from the dashboard configuration API response.
 *
 * Processing Examples:
 * For tenant "ramsay":
 * - Input: "https://${TENANT}-mlflow.${DOMAIN}/"
 *   Output: "https://ramsay-mlflow.cloud-tmp.physicsx.ai/"
 * - Input: "https://${TENANT}.${DOMAIN}/platform-app/app/optimizer"
 *   Output: "https://ramsay.cloud-tmp.physicsx.ai/platform-app/app/optimizer"
 *
 * For tenant "demo-dev":
 * - Input: "https://${TENANT}-mlflow.${DOMAIN}/"
 *   Output: "https://demo-dev-mlflow.cloud-tmp.physicsx.ai/"
 * - Input: "https://${TENANT}.${DOMAIN}/platform-app/app/optimizer"
 *   Output: "https://demo-dev.cloud-tmp.physicsx.ai/platform-app/app/optimizer"
 *
 * This function is called from main-page.js in _onDashboardLinksResponse()
 *
 * @param {Array} externalLinks - Array of external link objects from API
 * @param {string} tenant - The tenant name (ramsay, demo-dev, etc.)
 * @param {string} domain - The domain (optional, defaults to current domain)
 * @return {Array} Array of processed external link objects with URLs updated
 */
export function processExternalLinks(externalLinks, tenant, domain = null) {
    if (!Array.isArray(externalLinks) || !tenant) {
        return externalLinks;
    }

    // Process each external link object by updating its 'link' property
    return externalLinks.map((link) => {
        const processedLink = Object.assign({}, link);
        processedLink.link = processExternalLink(link.link, tenant, domain);
        return processedLink;
    });
}
