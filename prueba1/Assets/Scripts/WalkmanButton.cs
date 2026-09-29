using System.Collections;
using UnityEngine;
using UnityEngine.Events;

namespace Walkman
{
    /// <summary>
    /// Componente genérico para botones interactivos del Walkman.
    /// Soporta interacción por clic del ratón (OnMouseDown) o Raycast,
    /// animación física de pulsado (lerp suave) y reproducción de sonido.
    /// </summary>
    [RequireComponent(typeof(Collider))]
    [AddComponentMenu("Walkman/Walkman Button")]
    public class WalkmanButton : MonoBehaviour
    {
        [Header("Tipo de Botón")]
        [Tooltip("Si es true, funciona como interruptor (se queda presionado y al volver a pulsar se libera). Si es false, se presiona y regresa de inmediato.")]
        [SerializeField] private bool isToggleSwitch = true;

        [Header("Animación Física")]
        [Tooltip("Dirección local hacia la que se hunde el botón al presionarlo.")]
        [SerializeField] private Vector3 pressDirection = new Vector3(0, -1, 0);

        [Tooltip("Distancia en unidades locales que se desplaza el botón.")]
        [SerializeField] private float pressDistance = 0.05f;

        [Tooltip("Velocidad de la animación de presión/retorno.")]
        [SerializeField] private float animationSpeed = 15f;

        [Header("Audio")]
        [Tooltip("AudioSource para reproducir el clic mecánico (opcional).")]
        [SerializeField] private AudioSource audioSource;

        [Tooltip("Sonido que se reproduce al pulsar.")]
        [SerializeField] private AudioClip pressSound;

        [Tooltip("Sonido que se reproduce al soltar (opcional, útil para interruptores).")]
        [SerializeField] private AudioClip releaseSound;

        [Header("Eventos")]
        [Tooltip("Se dispara cada vez que el botón es presionado.")]
        public UnityEvent OnPressed;

        [Tooltip("Se dispara cada vez que el botón es soltado/liberado.")]
        public UnityEvent OnReleased;

        [Tooltip("Se dispara indicando el nuevo estado (true = presionado/activo, false = liberado).")]
        public UnityEvent<bool> OnToggled;

        // Estado interno
        private Vector3 initialLocalPosition;
        private Vector3 pressedLocalPosition;
        private Coroutine moveCoroutine;
        private bool isPressed = false;

        public bool IsPressed => isPressed;

        private void Awake()
        {
            // Guardamos la posición inicial de reposo
            initialLocalPosition = transform.localPosition;
            pressedLocalPosition = initialLocalPosition + (pressDirection.normalized * pressDistance);

            // Si no se asignó AudioSource manualmente, buscar uno en este objeto
            if (audioSource == null)
            {
                audioSource = GetComponent<AudioSource>();
            }
        }

        private void OnMouseDown()
        {
            // Llamado automático por Unity cuando se hace clic con el ratón sobre el Collider
            Interact();
        }

        /// <summary>
        /// Método público para interactuar con el botón (puede ser llamado desde Raycast, UI o XR).
        /// </summary>
        public void Interact()
        {
            if (isToggleSwitch)
            {
                // Modo conmutador: alternar estado
                SetPressedState(!isPressed);
            }
            else
            {
                // Modo pulsador momentáneo: pulsar y soltar
                StartCoroutine(MomentaryPressRoutine());
            }
        }

        /// <summary>
        /// Cambia el estado del botón manualmente.
        /// </summary>
        public void SetPressedState(bool pressed)
        {
            if (isPressed == pressed) return;

            isPressed = pressed;

            // Reproducir sonido correspondiente
            PlaySound(isPressed ? pressSound : (releaseSound != null ? releaseSound : pressSound));

            // Animar movimiento físico
            AnimateToPosition(isPressed ? pressedLocalPosition : initialLocalPosition);

            // Invocar eventos
            if (isPressed)
            {
                OnPressed?.Invoke();
            }
            else
            {
                OnReleased?.Invoke();
            }

            OnToggled?.Invoke(isPressed);
        }

        private IEnumerator MomentaryPressRoutine()
        {
            // Presionar
            PlaySound(pressSound);
            OnPressed?.Invoke();
            OnToggled?.Invoke(true);
            yield return MoveToPosition(pressedLocalPosition);

            // Breve pausa presionado
            yield return new WaitForSeconds(0.08f);

            // Liberar
            PlaySound(releaseSound != null ? releaseSound : pressSound);
            OnReleased?.Invoke();
            OnToggled?.Invoke(false);
            yield return MoveToPosition(initialLocalPosition);
        }

        private void AnimateToPosition(Vector3 targetPos)
        {
            if (moveCoroutine != null)
            {
                StopCoroutine(moveCoroutine);
            }
            moveCoroutine = StartCoroutine(MoveToPosition(targetPos));
        }

        private IEnumerator MoveToPosition(Vector3 targetPos)
        {
            while (Vector3.Distance(transform.localPosition, targetPos) > 0.0005f)
            {
                transform.localPosition = Vector3.Lerp(transform.localPosition, targetPos, Time.deltaTime * animationSpeed);
                yield return null;
            }
            transform.localPosition = targetPos;
            moveCoroutine = null;
        }

        private void PlaySound(AudioClip clip)
        {
            if (audioSource != null && clip != null)
            {
                audioSource.PlayOneShot(clip);
            }
        }

        // Permite visualizar en el Editor la dirección del desplazamiento del botón
        private void OnDrawGizmosSelected()
        {
            Vector3 origin = Application.isPlaying ? initialLocalPosition : transform.localPosition;
            if (transform.parent != null)
            {
                origin = transform.parent.TransformPoint(origin);
                Vector3 target = origin + transform.parent.TransformDirection(pressDirection.normalized * pressDistance);
                Gizmos.color = Color.cyan;
                Gizmos.DrawLine(origin, target);
                Gizmos.DrawWireSphere(target, pressDistance * 0.2f);
            }
        }
    }
}
