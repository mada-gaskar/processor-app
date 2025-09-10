import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import RootLayout from '../src/ui/RootLayout'
import Settings from '../src/ui/Settings'

function App(){
  return (
    <MemoryRouter initialEntries={["/settings"]}>
      <Routes>
        <Route path="/" element={<RootLayout />}> 
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

describe('Profile management', () => {
  beforeEach(()=>{
    localStorage.clear()
  })

  it('adds profiles without switching and allows switching explicitly', async () => {
    const user = userEvent.setup()
    render(<App />)

    // Wait for Settings page heading
    expect(await screen.findByRole('heading', { name: /settings/i })).toBeInTheDocument()

    const select = await screen.findByTestId('active-profile-select') as HTMLSelectElement
    // Initially only 1 user (default: Me)
    expect(select).toHaveDisplayValue('Me')

    const addBtn = screen.getByRole('button', { name: /add profile/i })

    // Add Alice and wait for option to appear
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Alice')
    await user.click(addBtn)
    promptSpy.mockRestore()
    expect(await within(select).findByRole('option', { name: 'Alice' })).toBeInTheDocument()

    // Add Bob and wait for option to appear
    const promptSpy2 = vi.spyOn(window, 'prompt').mockReturnValue('Bob')
    await user.click(addBtn)
    promptSpy2.mockRestore()
    const bobOption = await within(select).findByRole('option', { name: 'Bob' }) as HTMLOptionElement

    // Active should still be Me
    expect(select).toHaveDisplayValue('Me')

    // Select Bob explicitly using the option value
    await user.selectOptions(select, bobOption.value)

    // After switching, the select should show Bob (wait for state commit)
    await waitFor(() => expect(select).toHaveValue(bobOption.value))
    expect(select).toHaveDisplayValue('Bob')
  })

  it('edits only the selected profile', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(await screen.findByRole('heading', { name: /settings/i })).toBeInTheDocument()

    const select = await screen.findByTestId('active-profile-select') as HTMLSelectElement

    const addBtn = screen.getByRole('button', { name: /add profile/i })

    // Add Alice
    vi.spyOn(window, 'prompt').mockReturnValueOnce('Alice')
    await user.click(addBtn)
    expect(await within(select).findByRole('option', { name: 'Alice' })).toBeInTheDocument()

    // Add Bob
    vi.spyOn(window, 'prompt').mockReturnValueOnce('Bob')
    await user.click(addBtn)
    const bobOption = await within(select).findByRole('option', { name: 'Bob' }) as HTMLOptionElement

    // Switch to Alice
    const aliceOption = await within(select).findByRole('option', { name: 'Alice' }) as HTMLOptionElement
    await user.selectOptions(select, aliceOption.value)

    // Edit Alice
    const nameInput = screen.getByPlaceholderText('Name') as HTMLInputElement
    const roleInput = screen.getByPlaceholderText('Role') as HTMLInputElement
    await user.clear(nameInput)
    await user.type(nameInput, 'AliceUpdated')
    await user.clear(roleInput)
    await user.type(roleInput, 'Manager')
    await user.click(screen.getByRole('button', { name: /save/i }))

    // Switch to Bob and verify Bob is unchanged
    await user.selectOptions(select, bobOption.value)

    expect(nameInput.value).toBe('Bob')
    expect(roleInput.value).toBe('User')

    // Switch back to AliceUpdated
    const aliceUpdatedOption = await within(select).findByRole('option', { name: 'AliceUpdated' }) as HTMLOptionElement
    await user.selectOptions(select, aliceUpdatedOption.value)

    expect(nameInput.value).toBe('AliceUpdated')
    expect(roleInput.value).toBe('Manager')
  })
})