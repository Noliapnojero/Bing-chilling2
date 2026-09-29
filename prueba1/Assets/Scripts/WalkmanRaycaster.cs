using UnityEngine;

namespace Walkman
{
    /// <summary>
    /// Componente que se coloca en la Main Camera para permitir interactuar con
    /// los botones del Walkman mediante clics con el cursor o el centro de la pantalla.
    /// </summary>
    [RequireComponent(typeof(Camera))]
    [AddComponentMenu("Walkman/Walkman Raycaster")]
    public class WalkmanRaycaster : MonoBehaviour
    {
        [Header("Configuración de Raycast")]
        [Tooltip("Distancia máxima a la que se puede interactuar con los botones.")]
        [SerializeField] private float maxDistance = 5f;

        [Tooltip("Capa (Layer) en la que se encuentran los botones del Walkman (por defecto Everything).")]
        [SerializeField] private LayerMask interactableLayer = ~0;

        [Tooltip("Si es true, dispara el rayo desde el centro de la pantalla (ideal para primera persona con mira). Si es false, usa la posición del puntero del ratón.")]
        [SerializeField] private bool useScreenCenter = false;

        [Header("Puntero / Cursor (Opcional)")]
        [Tooltip("Textura del cursor cuando está sobre un botón interactivo.")]
        [SerializeField] private Texture2D hoverCursorTexture;
        [SerializeField] private Vector2 cursorHotspot = Vector2.zero;

        private Camera cam;
        private WalkmanButton currentHoveredButton;

        private void Awake()
        {
            cam = GetComponent<Camera>();
        }

        private void Update()
        {
            HandleRaycast();
            HandleInput();
        }

        private void HandleRaycast()
        {
            Ray ray = useScreenCenter
                ? cam.ViewportPointToRay(new Vector3(0.5f, 0.5f, 0))
                : cam.ScreenPointToRay(Input.mousePosition);

            if (Physics.Raycast(ray, out RaycastHit hit, maxDistance, interactableLayer))
            {
                WalkmanButton button = hit.collider.GetComponent<WalkmanButton>();
                if (button != null)
                {
                    if (currentHoveredButton != button)
                    {
                        currentHoveredButton = button;
                        SetHoverCursor(true);
                    }
                    return;
                }
            }

            // Si no estamos apuntando a ningún botón
            if (currentHoveredButton != null)
            {
                currentHoveredButton = null;
                SetHoverCursor(false);
            }
        }

        private void HandleInput()
        {
            // Clic izquierdo del ratón
            if (Input.GetMouseButtonDown(0) && currentHoveredButton != null)
            {
                currentHoveredButton.Interact();
            }
        }

        private void SetHoverCursor(bool isHovering)
        {
            if (hoverCursorTexture != null)
            {
                if (isHovering)
                {
                    Cursor.SetCursor(hoverCursorTexture, cursorHotspot, CursorMode.Auto);
                }
                else
                {
                    Cursor.SetCursor(null, Vector2.zero, CursorMode.Auto);
                }
            }
        }

        private void OnDisable()
        {
            // Restaurar cursor por defecto al deshabilitar
            if (hoverCursorTexture != null)
            {
                Cursor.SetCursor(null, Vector2.zero, CursorMode.Auto);
            }
        }
    }
}
