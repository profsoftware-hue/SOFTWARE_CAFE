import axios, { isAxiosError } from 'axios'

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined

export const API_BASE_URL =
  configuredBaseUrl?.replace(/\/$/, '') ?? 'http://localhost:8000/api/v1'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
  withCredentials: true,
})

export const getApiErrorMessage = (error: unknown): string => {
  if (isAxiosError(error)) {
    const detail = error.response?.data?.detail
    if (typeof detail === 'string') {
      return detail
    }
    if (Array.isArray(detail)) {
      return detail.map((item) => item?.msg).filter(Boolean).join(', ')
    }
    if (typeof error.response?.data === 'string' && error.response.data.trim()) {
      return error.response.data.trim()
    }
    if (error.response?.status) {
      return `Error ${error.response.status} del servidor`
    }
    if (error.code === 'ERR_NETWORK') {
      return 'No se pudo conectar con el servidor. Verifica que el backend esté activo.'
    }
    if (error.message) {
      return error.message
    }
  }
  return 'Ocurrió un error inesperado'
}
