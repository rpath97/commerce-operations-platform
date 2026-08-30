import type { Request, Response } from 'express'
import { requireUserId } from '../lib/request-auth.js'
import {
  createAddress,
  deleteAddress,
  listAddresses,
  updateAddress,
} from '../services/address.service.js'
import {
  addressBodySchema,
  addressIdParamSchema,
  updateAddressBodySchema,
} from '../validators/address.validator.js'
import { parseInput } from '../validators/parse.js'

export async function listAddressesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const data = await listAddresses(requireUserId(req))
  res.status(200).json({ data })
}

export async function createAddressHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const input = parseInput(addressBodySchema, req.body)
  const data = await createAddress(requireUserId(req), input)
  res.status(201).json({ data })
}

export async function updateAddressHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { addressId } = parseInput(addressIdParamSchema, req.params)
  const input = parseInput(updateAddressBodySchema, req.body)
  const data = await updateAddress(requireUserId(req), addressId, input)
  res.status(200).json({ data })
}

export async function deleteAddressHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { addressId } = parseInput(addressIdParamSchema, req.params)
  await deleteAddress(requireUserId(req), addressId)
  res.status(204).send()
}
