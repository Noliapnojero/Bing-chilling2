using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Events;

namespace Walkman
{
    /// <summary>
    /// Controlador central de energía del Walkman.
    /// Gestiona el encendido/apagado de luces físicas (Light) y de emisión de materiales (LEDs brillantes).
    /// </summary>
    [AddComponentMenu("Walkman/Walkman Power Controller")]
    public class WalkmanPowerController : MonoBehaviour
    {
        [Header("Estado Inicial")]
        [Tooltip("Define si el Walkman inicia encendido o apagado.")]
        [SerializeField] private bool isPoweredOn = false;

        [Header("Luces de Escena (Componentes Light)")]
        [Tooltip("Lista de luces de Unity (Point Light, Spot Light, etc.) que se encenderán con el Walkman.")]
        [SerializeField] private List<Light> indicatorLights = new List<Light>();

        [Header("Emisión de LEDs (Mesh Renderers)")]
        [Tooltip("Lista de Renderers cuyos materiales tienen emisión (ejemplo: bombilla del LED de Power).")]
        [SerializeField] private List<Renderer> ledRenderers = new List<Renderer>();

        [Tooltip("Color de emisión del LED cuando está encendido (con soporte HDR).")]
        [ColorUsage(true, true)]
        [SerializeField] private Color ledEmissionColorOn = new Color(2f, 0.2f, 0.2f, 1f); // Rojo brillante HDR por defecto

        [Tooltip("Color de emisión del LED cuando está apagado.")]
        [SerializeField] private Color ledEmissionColorOff = Color.black;

        [Header("Audio del Walkman")]
        [Tooltip("AudioSource para sonido de encendido o zumbido (opcional).")]
        [SerializeField] private AudioSource audioSource;

        [Tooltip("Sonido que suena al encender.")]
        [SerializeField] private AudioClip powerOnSound;

        [Tooltip("Sonido que suena al apagar.")]
        [SerializeField] private AudioClip powerOffSound;

        [Header("Eventos de Encendido")]
        public UnityEvent OnPowerOn;
        public UnityEvent OnPowerOff;
        public UnityEvent<bool> OnPowerChanged;

        private static readonly int EmissionColorPropertyId = Shader.PropertyToID("_EmissionColor");
        private MaterialPropertyBlock propertyBlock;

        public bool IsPoweredOn => isPoweredOn;

        private void Awake()
        {
            propertyBlock = new MaterialPropertyBlock();

            if (audioSource == null)
            {
                audioSource = GetComponent<AudioSource>();
            }

            // Aplicar estado inicial sin disparar sonidos de inicio
            ApplyPowerState(isPoweredOn, playSound: false);
        }

        /// <summary>
        /// Conmuta el estado de encendido/apagado.
        /// Ideal para enlazar en el evento OnPressed del WalkmanButton.
        /// </summary>
        public void TogglePower()
        {
            SetPower(!isPoweredOn);
        }

        /// <summary>
        /// Establece el estado de energía explícitamente.
        /// </summary>
        public void SetPower(bool state)
        {
            if (isPoweredOn == state) return;

            isPoweredOn = state;
            ApplyPowerState(isPoweredOn, playSound: true);

            // Disparar eventos
            if (isPoweredOn)
            {
                OnPowerOn?.Invoke();
            }
            else
            {
                OnPowerOff?.Invoke();
            }

            OnPowerChanged?.Invoke(isPoweredOn);
        }

        public void TurnOn() => SetPower(true);
        public void TurnOff() => SetPower(false);

        private void ApplyPowerState(bool on, bool playSound)
        {
            // 1. Control de Luces de Unity (Point Light, etc.)
            foreach (var light in indicatorLights)
            {
                if (light != null)
                {
                    light.enabled = on;
                }
            }

            // 2. Control de emisión en materiales de LEDs
            Color targetEmissionColor = on ? ledEmissionColorOn : ledEmissionColorOff;

            foreach (var rend in ledRenderers)
            {
                if (rend != null)
                {
                    rend.GetPropertyBlock(propertyBlock);
                    propertyBlock.SetColor(EmissionColorPropertyId, targetEmissionColor);
                    rend.SetPropertyBlock(propertyBlock);

                    // Habilitar la palabra clave de emisión en el material en caso de que esté desactivada
                    if (rend.material != null)
                    {
                        if (on)
                        {
                            rend.material.EnableKeyword("_EMISSION");
                        }
                        else
                        {
                            rend.material.DisableKeyword("_EMISSION");
                        }
                    }
                }
            }

            // 3. Audio de retroalimentación
            if (playSound && audioSource != null)
            {
                AudioClip clipToPlay = on ? powerOnSound : powerOffSound;
                if (clipToPlay != null)
                {
                    audioSource.PlayOneShot(clipToPlay);
                }
            }
        }
    }
}
