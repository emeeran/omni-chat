/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
    reactStrictMode: true,
    swcMinify: true,
    images: {
        domains: [''],
    },
    webpack: (config) => {
        config.resolve.alias['@'] = path.resolve(__dirname, 'src');
        return config;
    },
};

module.exports = nextConfig;